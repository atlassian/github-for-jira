import { Request, Response, Router } from "express";
import { errorWrapper } from "../../helper";
import { removeSubscription } from "utils/jira-utils";
import { Installation } from "models/installation";


export const SubscriptionDeleteRouter = Router({ mergeParams: true });


/**
 * This delete endpoint only handles Github cloud subscriptions
 */
SubscriptionDeleteRouter.delete("/", errorWrapper("SubscriptionDelete", async (req: Request, res: Response) => {
	// TODO: Get the github app id for GHE subscriptions
	const gitHubAppId = undefined;
	const subscriptionId: number = Number(req.params.subscriptionId);
	const { installation } = res.locals as { installation: Installation; };

	// Passing 0 as the `ghInstallationId` cause its not gonna be used anyways
	// TODO: Replace the usage og `ghInstallationId` by `subscriptionId`
	await removeSubscription(installation, 0, gitHubAppId, req, res, subscriptionId);
}));
