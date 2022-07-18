import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { validationResult } from "express-validator";
import { envVars } from "config/env";

export const GithubServerAppMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	const { jiraHost } = res.locals;
	const { uuid } = req.params;

	req.log = req.log.child({ uuid, jiraHost });

	if (uuid && validationResult(req).isEmpty()) {
		// uuid param exist, must be github server app
		req.log.debug(`Retrieving GitHub app with uuid ${uuid}`);
		const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);

		if (!gitHubServerApp) {
			req.log.error("No GitHub app found for provided uuid.");
			throw new Error("No GitHub app found for provided id.");
		}

		req.log.info("Found GitHub server app for installation");
		res.locals.githubAppConfig = {
			appId: gitHubServerApp.appId,
			clientId: gitHubServerApp.gitHubClientId,
			gitHubClientSecret: await gitHubServerApp.decrypt("gitHubClientSecret"),
			webhookSecret: await gitHubServerApp.decrypt("webhookSecret"),
			privateKey: await gitHubServerApp.decrypt("privateKey")
		};
	} else {
		// is cloud app
		res.locals.githubAppConfig = {
			appId: envVars.APP_ID,
			clientId: envVars.GITHUB_CLIENT_ID,
			gitHubClientSecret: envVars.GITHUB_CLIENT_SECRET,
			webhookSecret: envVars.WEBHOOK_SECRET,
			// once keylocator is merged
			// privateKey: keyLocator
		};
	}
	next();
};

