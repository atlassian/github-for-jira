import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";
import { envVars } from "config/env";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { resolveIntoConnectConfig } from "utils/ghe-connect-config-temp-storage";
import { getAllKnownHeaders } from "utils/http-headers";
import { errorStringFromUnknown } from "~/src/util/error-string-from-unknown";

export const JiraConnectEnterpriseAppCreateOrEditGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira create or edit app page request");
		let config;
		const uuidOfServerAppToEdit = req.params.uuid;
		const isNew = !uuidOfServerAppToEdit;

		const { jiraHost } = res.locals;

		if (!isNew) {
			const app = await GitHubServerApp.getForUuidAndInstallationId(uuidOfServerAppToEdit, res.locals.installation.id);
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
				apiKeyHeaderName: app.apiKeyHeaderName,
				apiKeyValue: app.encryptedApiKeyValue
					? await app.getDecryptedApiKeyValue(jiraHost)
					: "",
				serverUrl: app.gitHubBaseUrl,
				appUrl: envVars.APP_URL,
				uuid: uuidOfServerAppToEdit,
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
				apiKeyHeaderName: newServerAppConnectConfig.apiKeyHeaderName,
				apiKeyValue: newServerAppConnectConfig.encryptedApiKeyValue
					? await GitHubServerApp.decrypt(res.locals.installation.jiraHost, newServerAppConnectConfig.encryptedApiKeyValue)
					: "",
				appUrl: envVars.APP_URL,
				uuid: newUuid,
				csrfToken: req.csrfToken()
			};
		}

		await sendAnalytics(jiraHost, AnalyticsEventTypes.ScreenEvent, {
			name: AnalyticsScreenEventsEnum.CreateOrEditGitHubServerAppScreenEventName
		}, {
			isNew
		});

		res.render("jira-manual-app-creation.hbs", {
			... config,
			knownHttpHeadersLowerCase: getAllKnownHeaders()
		});
		req.log.debug("Jira create or edit app page rendered successfully.");
	} catch (error: unknown) {
		next(new Error(`Failed to render Jira create or edit app page: ${errorStringFromUnknown(error)}`)); return;
	}
};
