import { Request, Response } from "express";
import { extractSubscriptionDeferredInstallPayload } from "services/subscription-deferred-install-service";
import { hasAdminAccess } from "services/subscription-installation-service";

export const GitHubSubscriptionDeferredInstallGet = async (req: Request, res: Response) => {
	// Use only data from payload as it was created by Jira admin and cannot be forged. Do not access anything else from the request!
	const payload = await extractSubscriptionDeferredInstallPayload(req.params["requestId"]);

	const { githubToken, installation } = res.locals;

	if (!await hasAdminAccess(githubToken, installation.jiraHost, payload.gitHubInstallationId, req.log, payload.gitHubServerAppIdPk)) {
		res.render("subscription-deferred-install-approval-form.hbs", {
			notAdmin: true
		});
		return;
	}

	res.render("subscription-deferred-install-approval-form.hbs", {
		csrfToken: req.csrfToken(),
		orgName: payload.orgName,
		orgUrl: `${res.locals.gitHubAppConfig.hostname as string}/${payload.orgName}`,
		jiraHost: res.locals.jiraHost
	});

};
