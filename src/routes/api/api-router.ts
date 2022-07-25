import { NextFunction, Request, Response, Router } from "express";
import { param } from "express-validator";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import IORedis from "ioredis";
import { Subscription } from "models/subscription";
import { returnOnValidationError, serializeSubscription } from "./api-utils";
import { getRedisInfo } from "config/redis-info";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { ApiJiraRouter } from "./jira/api-jira-router";
import { LogMiddleware } from "middleware/frontend-log-middleware";
import { ApiInstallationRouter } from "./installation/api-installation-router";
import { json, urlencoded } from "body-parser";
import { ApiInstallationDelete } from "./installation/api-installation-delete";
import { ApiHashPost } from "./api-hash-post";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";
import { ApiPingPost } from "routes/api/api-ping-post";
import { CryptorMigrationRouter } from "./cryptor-migrations/migration-router";

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

		req.log = req.log.child({ slauth: {
			mechanism,
			issuer,
			principal,
			userGroup: req.get("X-Slauth-User-Groups"),
			aaid: req.get("X-Slauth-User-Aaid"),
			username: req.get("X-Slauth-User-Username")
		} });

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
		// A date to start fetching commit history(main and branch) from.
		const commitsFromDate = req.body.commitsFromDate && new Date(req.body.commitsFromDate);

		if (!statusTypes && !installationIds && !limit && !inactiveForSeconds){
			res.status(400).send("please provide at least one of the filter parameters!");
			return;
		}

		if (commitsFromDate && commitsFromDate.valueOf() > Date.now()) {
			res.status(400).send("Invalid commitsFromDate value, please enter valid historical date");
			return;
		}

		const subscriptions = await Subscription.getAllFiltered(installationIds, statusTypes, offset, limit, inactiveForSeconds);

		await Promise.all(subscriptions.map((subscription) =>
			findOrStartSync(subscription, req.log, syncType, commitsFromDate)
		));

		res.json(subscriptions.map(serializeSubscription));
	}
);

// Hash incoming values with GLOBAL_HASH_SECRET.
ApiRouter.post("/hash", ApiHashPost);

ApiRouter.post("/ping", ApiPingPost);

// TODO: remove once move to DELETE /:installationId/:jiraHost
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
ApiRouter.use("/migration", CryptorMigrationRouter);

ApiRouter.use("/jira", ApiJiraRouter);
ApiRouter.use("/:installationId", param("installationId").isInt(), returnOnValidationError, ApiInstallationRouter);
