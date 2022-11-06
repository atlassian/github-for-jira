import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { envVars } from "config/env";
import { keyLocator } from "../github/client/key-locator";
import { GITHUB_CLOUD_BASEURL, GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";

type ResponseBody = {
	message: string
}

type ResponseLocals = {
	jiraHost: string,
	gitHubAppId: number | undefined,
	gitHubAppConfig: GitHubAppConfigWithSecrets
}

export const GithubServerAppMiddleware = async (req: Request, res: Response<ResponseBody, ResponseLocals>, next: NextFunction): Promise<void> => {
	const { jiraHost } = res.locals;
	const { uuid } = req.params;

	req.addLogFields({ uuid, jiraHost });

	if (uuid) {
		req.log.debug(`Retrieving GitHub Enterprise Server app with uuid ${uuid}`);

		const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);

		if (!gitHubServerApp) {
			req.log.error("No GitHub app found for provided uuid.");
			res.status(404).json({
				message: "No GitHub app found for provided id."
			});
			return;
		}

		const installation = await Installation.findByPk(gitHubServerApp.installationId);

		if (installation?.jiraHost !== jiraHost) {
			req.log.error({ uuid, jiraHost }, "Jira hosts do not match");
			res.status(401).json({
				message: "Jira hosts do not match."
			});
			return;
		}

		req.log.info("Found server app for installation. Defining GitHub app config for GitHub Enterprise Server.");

		//TODO: ARC-1515 decide how to put `gitHubAppId ` inside `gitHubAppConfig`
		res.locals.gitHubAppId = gitHubServerApp.id;
		res.locals.gitHubAppConfig = {
			gitHubAppId: gitHubServerApp.id,
			appId: gitHubServerApp.appId,
			uuid: gitHubServerApp.uuid,
			gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
			gitHubApiUrl: gitHubServerApp.gitHubBaseUrl,
			clientId: gitHubServerApp.gitHubClientId,
			getGitHubClientSecret: async () => await gitHubServerApp.getDecryptedGitHubClientSecret(),
			getWebhookSecret: async () => await gitHubServerApp.getDecryptedWebhookSecret(),
			getPrivateKey: async () => await gitHubServerApp.getDecryptedPrivateKey()
		};
	} else {
		req.log.info("Defining GitHub app config for GitHub Cloud.");
		res.locals.gitHubAppConfig = {
			gitHubAppId: undefined,
			appId: Number(envVars.APP_ID),
			uuid: undefined, //undefined for cloud
			gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
			gitHubApiUrl: GITHUB_CLOUD_API_BASEURL,
			clientId: envVars.GITHUB_CLIENT_ID,
			getGitHubClientSecret: async () => envVars.GITHUB_CLIENT_SECRET,
			getWebhookSecret: async () => envVars.WEBHOOK_SECRET,
			getPrivateKey: async () => await keyLocator(undefined)
		};
	}

	next();
};

