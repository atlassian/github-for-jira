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
import { ApiInstallationDeleteForPollinator } from "./installation/api-installation-delete-pollinator";
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
import { ApiRecryptPost } from "./api-recrypt-post";
import { CoredumpGenerator } from "services/coredump-generator";

export const ApiRouter = Router();

// TODO: remove this duplication because of the horrible way to do logs through requests
ApiRouter.use(urlencoded({ extended: false }));
ApiRouter.use(json());
ApiRouter.use(LogMiddleware);

// Verify SLAuth headers to make sure that no open access was allowed for these endpoints
// And also log how the request was authenticated
const slauthMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
};
ApiRouter.use(slauthMiddleware);

const rateLimitMiddleware = rateLimit({
	store: new RedisStore({
		client: new IORedis(getRedisInfo("express-rate-limit"))
	}),
	windowMs: 60 * 1000, // 1 minutes
	max: 60 // limit each IP to 60 requests per windowMs
});
ApiRouter.use(rateLimitMiddleware);

const pingGet = (_: Request, res: Response): void => {
	res.send({});
};
ApiRouter.get("/", pingGet);

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

// Endpoint to recrypt encrypted value in a different encryption context
ApiRouter.post("/recrypt", ApiRecryptPost);

ApiRouter.post("/ping", ApiPingPost);

/**
 * Workable parameters for ddev (250Mb heap):
 * 	?arraySize=20000&nIter=400&pctThreshold=75
 */
const FillMemAndGenerateCoreDump = (req: Request, res: Response) => {
	const nIter = parseInt(req.query?.nIter?.toString() || "0");
	const arraySize = parseInt(req.query?.arraySize?.toString() || "10");
	const pctThreshold = parseInt(req.query?.pctThreshold?.toString() || "50");
	const generator = new CoredumpGenerator({
		logger: req.log,
		memLeftPctThesholdBeforeGc: pctThreshold,
		memLeftPctThesholdAfterGc: pctThreshold
	});
	let coreDumpGenerated = false;
	const allocate = (iter: number) => {
		if (generator.maybeGenerateCoreDump()) {
			coreDumpGenerated = true;
			return [];
		}
		const arr = new Array(arraySize).fill(`${Math.random()} This is a test string. ${Math.random()}`);

		if (iter + 1 < nIter) {
			const anotherOne = allocate(iter + 1);
			return arr.concat(anotherOne);
		}
		return arr;
	};
	res.json({ allocated: allocate(0).length, coreDumpGenerated });
};

ApiRouter.post("/fill-mem-and-generate-coredump", FillMemAndGenerateCoreDump);

// TODO: remove once move to DELETE /:installationId/:jiraHost
ApiRouter.delete(
	"/deleteInstallation/:installationId/:jiraHost/github-app-id/:gitHubAppId",
	param("installationId").isInt(),
	param("jiraHost").isString(),
	returnOnValidationError,
	ApiInstallationDeleteForPollinator
);
ApiRouter.delete(
	"/deleteInstallation/:installationId/:jiraHost",
	param("installationId").isInt(),
	param("jiraHost").isString(),
	returnOnValidationError,
	ApiInstallationDeleteForPollinator
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
const cryptorDebugEndpoint = async (_req: Request, resp: Response) => {
	try {
		let data = "";
		for (let i = 0; i < 10; i++) {
			data = `${data}-${Math.floor((Math.random() * 10))}`;
		}

		const encrypted = await EncryptionClient.encrypt(EncryptionSecretKeyEnum.GITHUB_SERVER_APP, data);

		await EncryptionClient.decrypt(encrypted);
		resp.status(200).send("ok");
	} catch (_) {
		resp.status(500).send("fail");
	}
};
ApiRouter.use("/cryptor", cryptorDebugEndpoint);

ApiRouter.use("/db-migration", DBMigrationsRouter);
ApiRouter.post("/recover-client-key", RecoverClientKeyPost);
ApiRouter.post("/re-encrypt-ghes-app", ReEncryptGitHubServerAppKeysPost);
ApiRouter.use("/data-cleanup", DataCleanupRouter);
ApiRouter.post("/recover-commits-from-date", RecoverCommitsFromDatePost);
ApiRouter.post("/reset-failed-pending-deployment-cursor", ResetFailedAndPendingDeploymentCursorPost);

ApiRouter.use("/jira", ApiJiraRouter);
ApiRouter.use("/:installationId", param("installationId").isInt(), returnOnValidationError, ApiInstallationRouter);
