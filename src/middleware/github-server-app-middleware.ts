import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { envVars } from "config/env";
import { keyLocator } from "../github/client/key-locator";
import { GITHUB_CLOUD_HOSTNAME } from "utils/get-github-client-config";

export const GithubServerAppMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { uuid } = req.params;

	if (uuid) {
		req.log = req.log.child({ uuid });
		req.log.debug("Received request for GitHub Enterprise Server");

		const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);

		if (!gitHubServerApp) {
			req.log.error("No GitHub app found for provided uuid.");
			throw new Error("No GitHub app found for provided id.");
		}

		const installation = await Installation.findByPk(gitHubServerApp.installationId);
		req.log.info("Found GitHub server app for installation");

		if (!installation?.jiraHost) {
			req.log.error({ uuid }, "No Jira host found for GitHub provided uuid.");
			throw new Error("No Jira host found.");
		}

		//TODO: ARC-1515 decide how to put `gitHubAppId ` inside `gitHubAppConfig`
		res.locals.gitHubAppId = gitHubServerApp.id;
		res.locals.gitHubAppConfig = {
			appId: gitHubServerApp.appId,
			uuid: gitHubServerApp.uuid,
			hostname: gitHubServerApp.gitHubBaseUrl,
			clientId: gitHubServerApp.gitHubClientId,
			gitHubClientSecret: await gitHubServerApp.decrypt("gitHubClientSecret"),
			webhookSecret: await gitHubServerApp.decrypt("webhookSecret"),
			privateKey: await gitHubServerApp.decrypt("privateKey")
		};

	} else {
		req.log.debug("Received request for GitHub Cloud");
		res.locals.gitHubAppConfig = {
			appId: envVars.APP_ID,
			uuid: undefined, //undefined for cloud
			hostname: GITHUB_CLOUD_HOSTNAME,
			clientId: envVars.GITHUB_CLIENT_ID,
			gitHubClientSecret: envVars.GITHUB_CLIENT_SECRET,
			webhookSecret: envVars.WEBHOOK_SECRET,
			privateKey: await keyLocator()
		};
	}

	next();
};

