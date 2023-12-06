import { Request, Response } from "express";
import { errorWrapper } from "../../helper";
import { createAppClient, createInstallationClient, createUserClient } from "utils/get-github-client-config";
import { InsufficientPermissionError, InvalidArgumentError, RestApiError } from "config/errors";
import { isUserAdminOfOrganization } from "utils/github-utils";
import { Subscription } from "models/subscription";

/**
 * This delete endpoint only handles Github cloud subscriptions
 */
export const SubscriptionDeleteRoute = errorWrapper("SubscriptionDelete", async (req: Request, res: Response) => {
	// TODO: Get the github app id for GHE subscriptions
	const gitHubAppId = undefined;
	const { installationId: gitHubInstallationId }: { installationId: number; } = req.body as { installationId: number };
	const { githubToken, jiraHost } = res.locals as { githubToken: string, jiraHost: string; };
	const metrics = {
		trigger: "github-subscription-delete-spa"
	};
	if (!gitHubInstallationId) {
		throw new InvalidArgumentError("Github Installation id is not passed");
	}
	if (!jiraHost) {
		throw new RestApiError(400, "RESOURCE_NOT_FOUND", "Jirahost not found");
	}

	const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppId, metrics);
	const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, jiraHost, metrics, req.log, gitHubAppId);
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, metrics, req.log, gitHubAppId);
	const { data: installation } = await gitHubAppClient.getInstallation(gitHubInstallationId);
	const { data: { login } } = await gitHubUserClient.getUser();

	if (!await isUserAdminOfOrganization(
		gitHubUserClient,
		gitHubInstallationClient ,
		installation.account.login,
		login,
		installation.target_type,
		req.log
	)) {
		throw new InsufficientPermissionError("Unauthorized to delete subscription");
	}

	try {
		const subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId, gitHubAppId);
		if (!subscription) {
			throw new RestApiError(500, "RESOURCE_NOT_FOUND", "Subscription not found");
		}
		await subscription.destroy();
		res.sendStatus(202);
	} catch (err: unknown) {
		req.log.warn("Cannot delete subscription");
		throw new RestApiError(500, "UNKNOWN", "Failed to delete the subscription");
	}
});
