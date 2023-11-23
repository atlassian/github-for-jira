import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { envVars } from "config/env";
import { GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { BaseLocals } from "../rest/routes";

export const GithubServerAppMiddleware = async (req: Request, res: Response<unknown, BaseLocals>, next: NextFunction): Promise<void> => {
	const jiraHost = res.locals.jiraHost;
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
			appId: String(gitHubServerApp.appId),
			uuid: gitHubServerApp.uuid,
			hostname: gitHubServerApp.gitHubBaseUrl,
			clientId: gitHubServerApp.gitHubClientId
		};
	} else {
		req.log.info("Defining GitHub app config for GitHub Cloud.");
		res.locals.gitHubAppConfig = {
			gitHubAppId: undefined,
			appId: envVars.APP_ID,
			uuid: undefined, //undefined for cloud
			hostname: GITHUB_CLOUD_BASEURL,
			clientId: envVars.GITHUB_CLIENT_ID
		};
	}

	next();
};

