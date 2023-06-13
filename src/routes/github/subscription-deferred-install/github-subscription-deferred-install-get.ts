import { Request, Response } from "express";
import { extractParsedPayload } from "utils/subscription-deferred-install-payload";
import { hasAdminAccess } from "services/subscription-installation-service";

export const GithubSubscriptionDeferredInstallGet = async (req: Request, res: Response) => {
	const payload = await extractParsedPayload(req);
	const { githubToken, installation } = res.locals;

	if (!await hasAdminAccess(githubToken, installation.jiraHost, payload.gitHubInstallationId, req.log, payload.gitHubServerAppIdPk)) {
		req.log.warn("Not an admin");
		res.status(401).json({
			error: "Must be a GitHub admin"
		});
		return;
	}

	res.json({
		... payload,
		jiraHost: res.locals.jiraHost,
		gitHubUrl: res.locals.gitHubAppConfig.hostname,
		... (res.locals.gitHubAppConfig.gitHubAppId ? {
			gheClientId: res.locals.gitHubAppConfig.clientId,
			gheAppId: res.locals.gitHubAppConfig.gheAppId
		} : { })
	});
};
