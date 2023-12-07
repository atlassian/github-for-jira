import { Router, Request, Response } from "express";
import { errorWrapper } from "../../helper";
import { getAllSubscriptions } from "./service";
import { Installation } from "models/installation";
import { removeSubscription } from "utils/jira-utils";
import { GitHubServerApp } from "models/github-server-app";
import { InvalidArgumentError } from "config/errors";
import { SyncRouterHandler } from "./sync";

export const SubscriptionsRouter = Router({ mergeParams: true  });

SubscriptionsRouter.get("/", errorWrapper("SubscriptionsGet", async (req: Request, res: Response) => {
	const { jiraHost, installation } = res.locals;
	const { ghCloudSubscriptions, ghEnterpriseServers } = await getAllSubscriptions(jiraHost as string, (installation as Installation).id, req);

	res.status(200).json({
		ghCloudSubscriptions,
		ghEnterpriseServers
	});
}));

/**
 * This delete endpoint only handles Github cloud subscriptions
 */
SubscriptionsRouter.delete("/", errorWrapper("SubscriptionDelete", async (req: Request, res: Response) => {
	const subscriptionId: number = Number(req.params.subscriptionId);
	const { installation } = res.locals as { installation: Installation; };

	const cloudOrUUID = req.params.cloudOrUUID;
	if (!cloudOrUUID) {
		throw new InvalidArgumentError("Invalid route, couldn't determine if its cloud or enterprise!");
	}

	// TODO: Check and add test cases for GHE later
	const gitHubAppId = cloudOrUUID === "cloud" ? undefined :
		(await GitHubServerApp.getForUuidAndInstallationId(cloudOrUUID, installation.id))?.appId; //TODO: validate the uuid regex

	await removeSubscription(installation, undefined, gitHubAppId, req.log, subscriptionId);

	res.sendStatus(204);
}));

SubscriptionsRouter.post("/sync", SyncRouterHandler);