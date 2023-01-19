import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";
import { envVars } from "config/env";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";

export const JiraConnectEnterpriseAppCreateOrEdit = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira create or edit app page request");
		let config;
		const uuid = req.params.uuid;

		const { jiraHost } = res.locals;

		if (uuid) {
			// TODO: add tests!!!
			const app = await GitHubServerApp.getForUuidAndInstallationId(uuid, res.locals.installation.id);
			if (!app) {
				req.log.warn("Cannot find the app");
				res.status(404).send({
					error: "The app is not found"
				});
				return;
			}
			config = {
				app,
				decryptedWebhookSecret: await app.getDecryptedWebhookSecret(jiraHost),
				decryptedGheSecret: await app.getDecryptedGitHubClientSecret(jiraHost),
				serverUrl: app.gitHubBaseUrl,
				appUrl: envVars.APP_URL,
				uuid,
				csrfToken: req.csrfToken()
			};
		} else {
			config = {
				serverUrl: req.params.serverUrl,
				appUrl: envVars.APP_URL,
				uuid: newUUID(),
				csrfToken: req.csrfToken()
			};
		}

		sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
			name: AnalyticsScreenEventsEnum.CreateOrEditGitHubServerAppScreenEventName,
			isNew: !!uuid
		});

		res.render("jira-manual-app-creation.hbs", config);
		req.log.debug("Jira create or edit app page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira create or edit app page: ${error}`));
	}
};
