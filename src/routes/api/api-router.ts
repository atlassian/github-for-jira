import { NextFunction, Request, Response, Router } from "express";
import { body, param } from "express-validator";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import IORedis from "ioredis";
import { returnOnValidationError } from "./api-utils";
import { getRedisInfo } from "config/redis-info";
import { ApiJiraRouter } from "./jira/api-jira-router";
import { LogMiddleware } from "middleware/frontend-log-middleware";
import { ApiInstallationRouter } from "./installation/api-installation-router";
import { json, urlencoded } from "body-parser";
import { ApiInstallationDelete } from "./installation/api-installation-delete";
import { ApiHashPost } from "./api-hash-post";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";
import { ApiPingPost } from "routes/api/api-ping-post";
import { ApiResyncPost } from "routes/api/api-resync-post";
import { UUID_REGEX } from "~/src/util/regex";
import { DBMigrationsRouter } from "./db-migrations/db-migration-router";
import { RecoverClientKeyPost } from "./client-key/recover-client-key";
import { ReEncryptGitHubServerAppKeysPost } from "./ghes-app-encryption-ctx/re-encrypt-ghes-app-keys";
import { ApiConfigurationRouter } from "routes/api/configuration/api-configuration-router";
import { DataCleanupRouter } from "./data-cleanup/data-cleanup-router";
import { ApiResetSubscriptionFailedTasks } from "./api-reset-subscription-failed-tasks";
import { RecoverCommitsFromDatePost } from "./commits-from-date/recover-commits-from-dates";
import { ResetFailedAndPendingDeploymentCursorPost } from "./commits-from-date/reset-failed-and-pending-deployment-cursors";

export const ApiRouter = Router();

// TODO: remove this duplication because of the horrible way to do logs through requests
ApiRouter.use(urlencoded({ extended: false }));
ApiRouter.use(json());
ApiRouter.use(LogMiddleware);

// Verify SLAuth headers to make sure that no open access was allowed for these endpoints
// And also log how the request was authenticated
ApiRouter.use(
	async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const mechanism = req.get("X-Slauth-Mechanism");
		const issuer = req.get("X-Slauth-Issuer");
		const principal = req.get("X-Slauth-Principal");

		req.addLogFields({
			slauth: {
				mechanism,
				issuer,
				principal,
				userGroup: req.get("X-Slauth-User-Groups"),
				aaid: req.get("X-Slauth-User-Aaid"),
				username: req.get("X-Slauth-User-Username")
			}
		});

		if (!mechanism || mechanism === "open") {
			req.log.warn("Attempt to access Admin API without authentication");
			res.status(401).json({ error: "Open access not allowed" });
			return;
		}

		req.log.info("API Request successfully authenticated");

		next();
	}
);

ApiRouter.use(rateLimit({
	store: new RedisStore({
		client: new IORedis(getRedisInfo("express-rate-limit"))
	}),
	windowMs: 60 * 1000, // 1 minutes
	max: 60 // limit each IP to 60 requests per windowMs
}));

ApiRouter.get("/", (_: Request, res: Response): void => {
	res.send({});
});

ApiRouter.use("/configuration", ApiConfigurationRouter);


ApiRouter.post(
	`/:uuid(${UUID_REGEX})?/resync`,
	body("commitsFromDate").optional().isISO8601(),
	body("targetTasks").optional().isArray(),
	returnOnValidationError,
	ApiResyncPost
);

ApiRouter.post(
	`/reset-subscription-failed-tasks`,
	ApiResetSubscriptionFailedTasks
);

// Hash incoming values with GLOBAL_HASH_SECRET.
ApiRouter.post("/hash", ApiHashPost);

ApiRouter.post("/ping", ApiPingPost);

// TODO: remove once move to DELETE /:installationId/:jiraHost
ApiRouter.delete(
	"/deleteInstallation/:installationId/:jiraHost/github-app-id/:gitHubAppId",
	param("installationId").isInt(),
	param("jiraHost").isString(),
	returnOnValidationError,
	ApiInstallationDelete
);
ApiRouter.delete(
	"/deleteInstallation/:installationId/:jiraHost",
	param("installationId").isInt(),
	param("jiraHost").isString(),
	returnOnValidationError,
	ApiInstallationDelete
);

// TODO: remove the debug endpoint
/*
How to invoke:

% atlas slauth curl -a github-for-jira -g micros-sv--github-for-jira-dl-admins -- \
-X GET \
-v https://github-for-jira.ap-southeast-2.dev.atl-paas.net/api/cryptor

`micros_github-for-jira` env=ddev "encrypted" , and then
`micros_github-for-jira` env=ddev "<ID value from previous request>"

 */
ApiRouter.use("/cryptor", async (_req: Request, resp: Response) => {
	try {
		let data = "";
		for (let i = 0; i < 10; i++) {
			data = data + "-" + Math.floor((Math.random() * 10));
		}

		const encrypted = await EncryptionClient.encrypt(EncryptionSecretKeyEnum.GITHUB_SERVER_APP, data);

		await EncryptionClient.decrypt(encrypted);
		resp.status(200).send("ok");
	} catch (_) {
		resp.status(500).send("fail");
	}
});
ApiRouter.use("/db-migration", DBMigrationsRouter);
ApiRouter.post("/recover-client-key", RecoverClientKeyPost);
ApiRouter.post("/re-encrypt-ghes-app", ReEncryptGitHubServerAppKeysPost);
ApiRouter.use("/data-cleanup", DataCleanupRouter);
ApiRouter.post("/recover-commits-from-date", RecoverCommitsFromDatePost);
ApiRouter.post("/reset-failed-pending-deployment-cursor", ResetFailedAndPendingDeploymentCursorPost);

ApiRouter.use("/jira", ApiJiraRouter);
ApiRouter.use("/:installationId", param("installationId").isInt(), returnOnValidationError, ApiInstallationRouter);
