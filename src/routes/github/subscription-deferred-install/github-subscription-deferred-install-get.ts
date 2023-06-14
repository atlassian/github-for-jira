import { Request, Response } from "express";
import { extractSubscriptionDeferredInstallPayload } from "services/subscription-deferred-install-service";
import { hasAdminAccess } from "services/subscription-installation-service";

const escapeHtml = (unsafe: string) => {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
};

export const GitHubSubscriptionDeferredInstallGet = async (req: Request, res: Response) => {
	const payload = await extractSubscriptionDeferredInstallPayload(req.params["requestId"]);
	const { githubToken, installation } = res.locals;

	if (!await hasAdminAccess(githubToken, installation.jiraHost, payload.gitHubInstallationId, req.log, payload.gitHubServerAppIdPk)) {
		req.log.warn("Not an admin");
		res.status(401).json({
			error: "Must be a GitHub admin"
		});
		return;
	}

	const payloadObjForReview = {
		... payload,
		jiraHost: res.locals.jiraHost,
		gitHubUrl: res.locals.gitHubAppConfig.hostname,
		... (res.locals.gitHubAppConfig.gitHubAppId ? {
			gheClientId: res.locals.gitHubAppConfig.clientId,
			gheAppId: res.locals.gitHubAppConfig.gheAppId
		} : { })
	};

	res.send(
		`
		<html>
			<body>
				<p>
					Do you approve connecting ${escapeHtml(payload.orgName)} (${escapeHtml(res.locals.gitHubAppConfig.hostname)}) to ${res.locals.jiraHost}?
				</p>
				<textarea>
${escapeHtml(JSON.stringify(payloadObjForReview, null, 2))}
				</textarea>
				<form method="post">
					<input type="submit" value="Approve" />
				</form>
			</body>
		</html>
		`
	);
};
