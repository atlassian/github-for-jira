import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";
import { envVars } from "config/env";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { resolveIntoConnectConfig } from "utils/ghe-connect-config-temp-storage";

export const JiraConnectEnterpriseAppCreateOrEditGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira create or edit app page request");
		let config;
		const uuidOfServerAppForEdit = req.params.uuid;
		const isNew = !!uuidOfServerAppForEdit;

		const { jiraHost } = res.locals;

		if (!isNew) {
			// TODO: add tests!!!
			const app = await GitHubServerApp.getForUuidAndInstallationId(uuidOfServerAppForEdit, res.locals.installation.id);
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
				uuid: uuidOfServerAppForEdit,
				csrfToken: req.csrfToken()
			};
		} else {

			const newServerAppConnectConfig = await resolveIntoConnectConfig(req.params.tempConnectConfigUuidOrServerUuid, res.locals.installation.id);
			if (!newServerAppConnectConfig) {
				req.log.warn({ connectConfigUuid: req.params.tempConnectConfigUuidOrServerUuid }, "No connect config was found");
				res.sendStatus(404);
				return;
			}

			// We don't want to re-use existing UUID to avoid grief
			const newUuid = (await GitHubServerApp.findForUuid(req.params.tempConnectConfigUuidOrServerUuid))
				? newUUID()
				: req.params.tempConnectConfigUuidOrServerUuid;

			config = {
				serverUrl: newServerAppConnectConfig.serverUrl,
				// TODO: copy other values from the newServerAppConnectConfig
				appUrl: envVars.APP_URL,
				uuid: newUuid,
				csrfToken: req.csrfToken()
			};
		}

		sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
			name: AnalyticsScreenEventsEnum.CreateOrEditGitHubServerAppScreenEventName,
			isNew
		});

		res.render("jira-manual-app-creation.hbs", config);
		req.log.debug("Jira create or edit app page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira create or edit app page: ${error}`));
	}
};
