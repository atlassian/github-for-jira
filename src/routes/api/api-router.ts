import { NextFunction, Request, Response, Router } from "express";
import { param } from "express-validator";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import IORedis from "ioredis";
import GithubAPI from "../../config/github-api";
import { Subscription } from "../../models";
import { returnOnValidationError, serializeSubscription } from "./api-utils";
import getRedisInfo from "../../config/redis-info";
import { findOrStartSync } from "../../sync/sync-utils";
import { ApiJiraRouter } from "./jira/api-jira-router";
import { LogMiddleware } from "../../middleware/frontend-log-middleware";
import { ApiInstallationRouter } from "./installation/api-installation-router";
import { json, urlencoded } from "body-parser";

export const ApiRouter = Router();

const viewerPermissionQuery = `{
  viewer {
    login
    organization(login: "fusion-arc") {
      viewerCanAdminister
    }
  }
}
`;

function validAdminPermission(viewer) {
	return viewer.organization?.viewerCanAdminister || false;
}

// TODO: remove this duplication because of the horrible way to do logs through requests
ApiRouter.use(urlencoded({ extended: false }));
ApiRouter.use(json());
ApiRouter.use(LogMiddleware);

ApiRouter.use(rateLimit({
	store: new RedisStore({
		client: new IORedis(getRedisInfo("express-rate-limit"))
	}),
	windowMs: 60 * 1000, // 1 minutes
	max: 60 // limit each IP to 60 requests per windowMs
}));

// All routes require a PAT to belong to someone on staff
// This middleware will take the token and make a request to GraphQL
// to see if it belongs to someone on staff

ApiRouter.use(
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

			req.addLogFields({ login: data?.viewer?.login });

			if (errors) {
				res.status(401).json({ errors, viewerPermissionQuery });
				return;
			}

			if (!validAdminPermission(data.viewer)) {
				req.log.info(
					{
						login: data.viewer.login,
						isAdmin: data.viewer.organization?.viewerCanAdminister
					},
					`User attempted to access admin API routes.`
				);
				res.status(401).json({
					error: "Unauthorized",
					message: "Token provided does not have required access"
				});
				return;
			}

			req.log.info({
				req,
				login: data.viewer.login,
				isAdmin: data.viewer.organization?.viewerCanAdminister
			},
			"Admin API routes accessed"
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

ApiRouter.get("/", (_: Request, res: Response): void => {
	res.send({});
});

// RESYNC ALL INSTANCES
ApiRouter.post(
	"/resync",
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
			findOrStartSync(subscription, req.log, syncType)
		));

		res.json(subscriptions.map(serializeSubscription));
	}
);

ApiRouter.use("/jira", ApiJiraRouter);
ApiRouter.use("/:installationId", param("installationId").isInt(), returnOnValidationError, ApiInstallationRouter);
