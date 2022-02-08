import express, { Request, Response } from "express";
import { check } from "express-validator";
import BodyParser from "body-parser";
import { RepoSyncState, Subscription } from "../../../models";
import { returnOnValidationError } from "../api-utils";
import getJiraClient from "../../../jira/client";
import { findOrStartSync } from "../../../sync/sync-utils";
import format from "date-fns/format";

export const ApiInstallationRouter = express.Router();
const bodyParser = BodyParser.urlencoded({ extended: false });

ApiInstallationRouter.get(
	"/:jiraHost/syncstate",
	check("jiraHost").isString(),
	returnOnValidationError,
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

			res.json(await RepoSyncState.toRepoJson(subscription));
		} catch (err) {
			res.status(500).json(err);
		}
	}
);

ApiInstallationRouter.post(
	"/sync",
	bodyParser,
	returnOnValidationError,
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

			await findOrStartSync(subscription, req.log, resetType);

			res.status(202).json({
				message: `Successfully (re)started sync for ${githubInstallationId}`
			});
		} catch (err) {
			req.log.info(err);
			res.sendStatus(401);
		}
	}
);

ApiInstallationRouter.get(
	"/",
	returnOnValidationError,
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
				subscriptions.map(async (subscription) => {
					const id = subscription.gitHubInstallationId;
					try {
						const response = await client.apps.getInstallation({ installation_id: id });
						response.data.syncStatus = subscription.syncStatus;
						return response.data;
					} catch (err) {
						return { error: err, id, deleted: err.status === 404 };
					}
				})
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
				syncStateUrl: `${req.protocol}://${req.get("host")}/api/${installationId}/${encodeURIComponent(jiraHost)}/syncstate`
			});
		} catch (err) {
			req.log.error({ installationId, err }, "Error getting installation");
			res.status(500).json(err);
		}
	}
);

ApiInstallationRouter.delete(
	"/:jiraHost",
	check("jiraHost").isString(),
	returnOnValidationError,
	async (req: Request, res: Response): Promise<void> => {
		const githubInstallationId = req.params.installationId;
		const jiraHost = req.params.jiraHost;

		if (!jiraHost || !githubInstallationId) {
			const msg = "Missing Jira Host or Installation ID";
			req.log.warn({ req, res }, msg);
			res.status(400).send(msg);
			return;
		}

		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			Number(githubInstallationId)
		);

		if (!subscription) {
			req.log.info("no subscription");
			res.sendStatus(404);
			return;
		}

		try {
			const jiraClient = await getJiraClient(jiraHost, Number(githubInstallationId), req.log);
			req.log.info(`Deleting dev info for jiraHost: ${jiraHost} githubInstallationId: ${githubInstallationId}`);
			await jiraClient.devinfo.installation.delete(githubInstallationId);
			res.status(200).send(`devinfo deleted for jiraHost: ${jiraHost} githubInstallationId: ${githubInstallationId}`);
		} catch (err) {
			res.status(500).json(err);
		}
	}
);
