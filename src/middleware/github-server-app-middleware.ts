import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { validationResult } from "express-validator";
import { envVars } from "config/env";

export const GithubServerAppMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	const { jiraHost } = res.locals;
	const { uuid } = req.params;

	console.log('----- server middleware-----', {
		path: req.path,
		uuid: req.params.uuid,
		result: JSON.stringify(validationResult(req))
	});

	req.log = req.log.child({ uuid, jiraHost });

	// uuid param exist, must be github server app
	if (validationResult(req).isEmpty()) {
		req.log.debug(`Retrieving GitHub app with uuid ${uuid}`);
		const gitHubServerApp = await GitHubServerApp.findForUuid(uuid, res.locals.installation.id);

		if (!gitHubServerApp) {
			req.log.error("No GitHub app found for provided uuid.");
			throw new Error("No GitHub app found for provided id.");
		}

		req.log.info("Found GitHub server app for installation");
		res.locals.githubAppConfig = {
			appId: gitHubServerApp.appId,
			webhookSecret: gitHubServerApp.decrypt("webhookSecret"),
			clientId: gitHubServerApp.gitHubClientId,
			secret: gitHubServerApp.gitHubClientSecret,
			privateKey: gitHubServerApp.decrypt("privateKey")
		};
	} else {
		// is cloud app
		res.locals.githubAppConfig = {
			appId: envVars.APP_ID,
			webhookSecret: envVars.WEBHOOK_SECRET,
			clientId: envVars.GITHUB_CLIENT_ID,
			secret: envVars.GITHUB_CLIENT_SECRET
			// once keylocator is merged
			// privateKey: keyLocator
		};
	}
	next();
};

