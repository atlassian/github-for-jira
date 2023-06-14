import { Request, Response } from "express";
import {
	extractSubscriptionDeferredInstallPayload,
	forgetSubscriptionDeferredInstallRequest
} from "services/subscription-deferred-install-service";
import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";

export const GithubSubscriptionDeferredInstallPost = async (req: Request, res: Response) => {
	const payload = await extractSubscriptionDeferredInstallPayload(req.params["requestId"]);
	const { githubToken, installation } = res.locals;

	const result = await verifyAdminPermsAndFinishInstallation(
		githubToken, installation, payload.gitHubServerAppIdPk, payload.gitHubInstallationId, req.log
	);
	if (result.error) {
		res.status(401).json(result);
		return;
	}

	await forgetSubscriptionDeferredInstallRequest(req.params["requestId"]);

	res.status(200).json({
		jiraHost: installation.jiraHost,
		orgName: payload.orgName,
		status: "connected",
		message: `${payload.orgName} has been connected to ${installation.jiraHost} Jira`
	});
};
