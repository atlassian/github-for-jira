import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { envVars } from "config/env";
import { keyLocator } from "../github/client/key-locator";
import { GITHUB_CLOUD_BASEURL } from "utils/get-github-client-config";

export const GithubServerAppMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { jiraHost } = res.locals;
	const { uuid } = req.params;

	req.addLogFields({ uuid, jiraHost });

	if (uuid) {
		req.log.debug(`Retrieving GitHub Enterprise Server app with uuid ${uuid}`);

		const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);

		if (!gitHubServerApp) {
			req.log.error("No GitHub app found for provided uuid.");
			return next(new Error("No GitHub app found for provided id."));
		}

		const installation = await Installation.findByPk(gitHubServerApp.installationId);

		if (installation?.jiraHost !== jiraHost) {
			req.log.error({ uuid, jiraHost }, "Jira hosts do not match");
			return next(new Error("Jira hosts do not match."));
		}

		req.log.info("Found server app for installation. Defining GitHub app config for GitHub Enterprise Server.");

		//TODO: ARC-1515 decide how to put `gitHubAppId ` inside `gitHubAppConfig`
		res.locals.gitHubAppId = gitHubServerApp.id;
		res.locals.gitHubAppConfig = {
			gitHubAppId: gitHubServerApp.id,
			appId: gitHubServerApp.appId,
			uuid: gitHubServerApp.uuid,
			hostname: gitHubServerApp.gitHubBaseUrl,
			clientId: gitHubServerApp.gitHubClientId,
			gitHubClientSecret: await gitHubServerApp.getDecryptedGitHubClientSecret(),
			webhookSecret: await gitHubServerApp.getDecryptedWebhookSecret(),
			privateKey: await gitHubServerApp.getDecryptedPrivateKey()
		};
	} else {
		req.log.info("Defining GitHub app config for GitHub Cloud.");
		res.locals.gitHubAppConfig = {
			gitHubAppId: undefined,
			appId: envVars.APP_ID,
			uuid: undefined, //undefined for cloud
			hostname: GITHUB_CLOUD_BASEURL,
			clientId: envVars.GITHUB_CLIENT_ID,
			gitHubClientSecret: envVars.GITHUB_CLIENT_SECRET,
			webhookSecret: envVars.WEBHOOK_SECRET,
			privateKey: await keyLocator(undefined)
		};
	}

	next();
};

