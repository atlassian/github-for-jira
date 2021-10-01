import express, { NextFunction, Request, Response } from "express";
import { check, oneOf, validationResult } from "express-validator";
import format from "date-fns/format";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";
import BodyParser from "body-parser";
import GithubAPI from "../config/github-api";
import { Installation, Subscription } from "../models";
import verifyInstallation from "../jira/verify-installation";
import logMiddleware from "../middleware/log-middleware";
import JiraClient from "../models/jira-client";
import uninstall from "../jira/uninstall";
import { serializeJiraInstallation, serializeSubscription } from "./serializers";
import getRedisInfo from "../config/redis-info";
import { elapsedTimeMetrics } from "../config/statsd";
import { queues } from "../worker/queues";
import { getLogger } from "../config/logger";
import { Job, Queue } from "bull";
import { WhereOptions } from "sequelize";

const router = express.Router();
const bodyParser = BodyParser.urlencoded({ extended: false });
const logger = getLogger("api");

async function getInstallation(client, subscription) {
	const id = subscription.gitHubInstallationId;
	try {
		const response = await client.apps.getInstallation({ installation_id: id });
		response.data.syncStatus = subscription.syncStatus;
		return response.data;
	} catch (err) {
		return { error: err, id, deleted: err.status === 404 };
	}
}

function validAdminPermission(viewer) {
	return viewer.organization?.viewerCanAdminister || false;
}

/**
 * Finds the validation errors in this request and wraps them in an object with handy functions
 */
function returnOnValidationError(
	req: Request,
	res: Response,
	next: NextFunction
): void {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(422).json({ errors: errors.array() });
	}
	next();
}

const viewerPermissionQuery = `{
  viewer {
    login
    organization(login: "fusion-arc") {
      viewerCanAdminister
    }
  }
}
`;

router.use(rateLimit({
	store: new RedisStore({
		client: new Redis(getRedisInfo("express-rate-limit"))
	}),
	windowMs: 60 * 1000, // 1 minutes
	max: 60 // limit each IP to 60 requests per windowMs
}));

router.use(logMiddleware);

// All routes require a PAT to belong to someone on staff
// This middleware will take the token and make a request to GraphQL
// to see if it belongs to someone on staff

router.use(
	async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const token = req.get("Authorization");
		if (!token) {
			res.sendStatus(404);
			return;
		}
		try {
			// Create a separate octokit instance than the one used by the app
			const octokit = GithubAPI({
				auth: token.split(" ")[1]
			});
			const { data, errors } = (
				await octokit.request({
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json"
					},
					method: "POST",
					// 'viewer' will be the person that owns the token
					query: viewerPermissionQuery,
					url: "/graphql"
				})
			).data;

			req.addLogFields({ login: data && data.viewer && data.viewer.login });

			if (errors) {
				res.status(401).json({ errors, viewerPermissionQuery });
				return;
			}

			if (!validAdminPermission(data.viewer)) {
				req.log.info(
					`User attempted to access staff routes: login=${data.viewer.login}, viewerCanAdminister=${data.viewer.organization?.viewerCanAdminister}`
				);
				res.status(401).json({
					error: "Unauthorized",
					message: "Token provided does not have required access"
				});
				return;
			}

			req.log.info(
				`Staff routes accessed: login=${data.viewer.login}, viewerCanAdminister=${data.viewer.organization?.viewerCanAdminister}`
			);

			next();
		} catch (err) {
			req.log.info({ err });

			if (err.status === 401) {
				res.status(401).send(err.HttpError);
				return;
			}
			res.sendStatus(500);
		}
	}
);

router.get(
	"/",
	elapsedTimeMetrics,
	(_: Request, res: Response): void => {
		res.send({});
	}
);

router.get(
	"/:installationId/:jiraHost/repoSyncState.json",
	check("installationId").isInt(),
	check("jiraHost").isString(),
	returnOnValidationError,
	elapsedTimeMetrics,
	async (req: Request, res: Response): Promise<void> => {
		const githubInstallationId = Number(req.params.installationId);
		const jiraHost = req.params.jiraHost;

		if (!jiraHost || !githubInstallationId) {
			const msg = "Missing Jira Host or Installation ID";
			req.log.warn({ req, res }, msg);
			res.status(400).send(msg);
			return;
		}

		try {
			const subscription = await Subscription.getSingleInstallation(
				jiraHost,
				githubInstallationId
			);

			if (!subscription) {
				res.status(404).send(`No Subscription found for jiraHost "${jiraHost}" and installationId "${githubInstallationId}"`);
				return;
			}

			res.json(subscription.repoSyncState);
		} catch (err) {
			res.status(500).json(err);
		}
	}
);

router.post(
	"/:installationId/sync",
	bodyParser,
	check("installationId").isInt(),
	returnOnValidationError,
	elapsedTimeMetrics,
	async (req: Request, res: Response): Promise<void> => {
		const githubInstallationId = Number(req.params.installationId);
		req.log.info(req.body);
		const { jiraHost, resetType } = req.body;

		try {
			req.log.info(jiraHost, githubInstallationId);
			const subscription = await Subscription.getSingleInstallation(
				jiraHost,
				githubInstallationId
			);

			if (!subscription) {
				res.sendStatus(404);
				return;
			}

			await Subscription.findOrStartSync(subscription, resetType);

			res.status(202).json({
				message: `Successfully (re)started sync for ${githubInstallationId}`
			});
		} catch (err) {
			req.log.info(err);
			res.sendStatus(401);
		}
	}
);

// RESYNC ALL INSTANCES
router.post(
	"/resync",
	bodyParser,
	elapsedTimeMetrics,
	async (req: Request, res: Response): Promise<void> => {
		// Partial by default, can be made full
		const syncType = req.body.syncType || "partial";
		// Defaults to anything not completed
		const statusTypes = req.body.statusTypes as string[];
		// Defaults to any installation
		const installationIds = req.body.installationIds as number[];
		// Can be limited to a certain amount if needed to not overload system
		const limit = Number(req.body.limit) || undefined;
		// Needed for 'pagination'
		const offset = Number(req.body.offset) || 0;
		// only resync installations whose "updatedAt" date is older than x seconds
		const inactiveForSeconds = Number(req.body.inactiveForSeconds) || undefined;

		const subscriptions = await Subscription.getAllFiltered(installationIds, statusTypes, offset, limit, inactiveForSeconds);

		await Promise.all(subscriptions.map((subscription) =>
			Subscription.findOrStartSync(subscription, syncType)
		));

		res.json(subscriptions.map(serializeSubscription));
	}
);

router.post(
	"/dedupInstallationQueue",
	bodyParser,
	elapsedTimeMetrics,
	async (_: Request, res: Response): Promise<void> => {

		// This remove all jobs from the queue. This way,
		// the whole queue will be drained and all jobs will be readded.
		const jobs = await queues.installation.getJobs(["active", "delayed", "waiting", "paused"]);
		const foundJobIds = new Set<string>();
		const duplicateJobs: Job[] = [];

		// collecting duplicate jobs per installation
		for (const job of jobs) {
			// getJobs() sometimes seems to include a "null" job in the array
			if (!job) {
				continue;
			}
			if (foundJobIds.has(`${job.data.installationId}${job.data.jiraHost}`)) {
				duplicateJobs.push(job);
			} else {
				foundJobIds.add(`${job.data.installationId}${job.data.jiraHost}`);
			}
		}

		// removing duplicate jobs
		await Promise.all(duplicateJobs.map((job: Job) => {
			logger.info({ job }, "removing duplicate job");
			job.remove();
		}));

		res.send(`${duplicateJobs.length} duplicate jobs killed with fire.`);
	}
);

router.post(
	"/requeue",
	bodyParser,
	elapsedTimeMetrics,
	async (request: Request, res: Response): Promise<void> => {

		const queueName = request.body.queue;   // "installation", "push", "metrics", or "discovery"
		const jobTypes = request.body.jobTypes || ["active", "delayed", "waiting", "paused"];

		if (!jobTypes.length) {
			res.status(400);
			res.send("please specify the jobTypes field (available job types: [\"active\", \"delayed\", \"waiting\", \"paused\"])");
			return;
		}

		const queue: Queue = queues[queueName];

		if (!queue) {
			res.status(400);
			res.send(`queue ${queueName} does not exist (available queues: "installation", "push", "metrics", or "discovery"`);
			return;
		}

		// This remove all jobs from the queue. This way,
		// the whole queue will be drained and all jobs will be readded.
		const jobs = await queue.getJobs(jobTypes);

		await Promise.all(jobs.map(async (job: Job) => {
			try {
				await job.remove();
				await queue.add(job.data);
				logger.info({ job: job }, "requeued job");
			} catch (e) {
				// do nothing
			}
		}));

		res.send(`${jobs.length} jobs discarded and re-added.`);
	}
);

router.get(
	"/jira/:clientKeyOrJiraHost",
	[
		bodyParser,
		oneOf([
			check("clientKeyOrJiraHost").isURL(),
			check("clientKeyOrJiraHost").isHexadecimal()
		]),
		returnOnValidationError,
		elapsedTimeMetrics
	],
	async (req: Request, res: Response): Promise<void> => {
		const where: WhereOptions = req.params.clientKeyOrJiraHost.startsWith("http")
			? { jiraHost: req.params.clientKeyOrJiraHost }
			: { clientKey: req.params.clientKeyOrJiraHost };
		const jiraInstallations = await Installation.findAll({ where });
		if (!jiraInstallations.length) {
			res.sendStatus(404);
			return;
		}
		res.json(jiraInstallations.map((jiraInstallation) =>
			serializeJiraInstallation(jiraInstallation, req.log)
		));
	}
);

router.post(
	"/jira/:clientKey/uninstall",
	bodyParser,
	check("clientKey").isHexadecimal(),
	returnOnValidationError,
	elapsedTimeMetrics,
	async (request: Request, response: Response): Promise<void> => {
		response.locals.installation = await Installation.findOne({
			where: { clientKey: request.params.clientKey }
		});

		if (!response.locals.installation) {
			response.sendStatus(404);
			return;
		}
		const jiraClient = new JiraClient(
			response.locals.installation,
			request.log
		);
		const checkAuthorization = request.body.force !== "true";

		if (checkAuthorization && (await jiraClient.isAuthorized())) {
			response
				.status(400)
				.json({
					message: "Refusing to uninstall authorized Jira installation"
				});
			return;
		}
		request.log.info(
			`Forcing uninstall for ${response.locals.installation.clientKey}`
		);
		await uninstall(request, response);
	}
);

router.post(
	"/jira/:installationId/verify",
	bodyParser,
	check("installationId").isInt(),
	returnOnValidationError,
	elapsedTimeMetrics,
	async (req: Request, response: Response): Promise<void> => {
		const { installationId } = req.params;
		const installation = await Installation.findByPk(installationId);

		const respondWith = (message) =>
			response.json({
				message,
				installation: {
					enabled: installation.enabled,
					id: installation.id,
					jiraHost: installation.jiraHost
				}
			});

		if (installation.enabled) {
			respondWith("Installation already enabled");
			return;
		}
		await verifyInstallation(installation, req.log)();
		respondWith(
			installation.enabled ? "Verification successful" : "Verification failed"
		);
	}
);

router.get(
	"/:installationId",
	check("installationId").isInt(),
	returnOnValidationError,
	elapsedTimeMetrics,
	async (req: Request, res: Response): Promise<void> => {
		const { installationId } = req.params;
		const { client } = res.locals;

		try {
			const subscriptions = await Subscription.getAllForInstallation(
				Number(installationId)
			);

			if (!subscriptions.length) {
				res.sendStatus(404);
				return;
			}

			const { jiraHost } = subscriptions[0];
			const installations = await Promise.all(
				subscriptions.map((subscription) =>
					getInstallation(client, subscription)
				)
			);
			const connections = installations
				.filter((response) => !response.error)
				.map((data) => ({
					...data,
					isGlobalInstall: data.repository_selection === "all",
					updated_at: format(data.updated_at, "MMMM D, YYYY h:mm a"),
					syncState: data.syncState
				}));

			const failedConnections = installations.filter((response) => {
				req.log.error({ ...response }, "Failed installation");
				return response.error;
			});

			res.json({
				host: jiraHost,
				installationId,
				connections,
				failedConnections,
				hasConnections: connections.length > 0 || failedConnections.length > 0,
				repoSyncState: `${req.protocol}://${req.get(
					"host"
				)}/api/${installationId}/repoSyncState.json`
			});
		} catch (err) {
			req.log.error({ installationId, err }, "Error getting installation");
			res.status(500).json(err);
		}
	}
);

export default router;
