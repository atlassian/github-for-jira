import { Request, Response } from "express";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { Errors } from "config/errors";
import { createAnonymousClient } from "utils/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";

export const GithubManifestCompleteGet = async (req: Request, res: Response) => {
	const uuid = req.params.uuid;

	const connectConfig = await new GheConnectConfigTempStorage().get(uuid, res.locals.installation.id);
	if (!connectConfig) {
		req.log.warn("No connect config found");
		res.sendStatus(404);
		return;
	}

	if (await GitHubServerApp.findForUuid(uuid)) {
		req.log.error({ connectConfigUuid: uuid }, "There's already GitHubServerApp with such UUID, halting");
		res.sendStatus(400);
		return;
	}

	const gheHost = connectConfig.serverUrl;

	if (!req.query.code) {
		req.log.warn("No code was provided");
		res.sendStatus(400);
		return;
	}

	try {
		const metrics = {
			trigger: "manifest"
		};
		const gitHubClient = await createAnonymousClient(gheHost, res.locals.jiraHost, metrics, req.log);
		const gitHubAppConfig = await gitHubClient.createGitHubApp("" + req.query.code);
		await GitHubServerApp.install({
			uuid,
			appId: gitHubAppConfig.id,
			gitHubAppName: gitHubAppConfig.name,
			gitHubBaseUrl: gheHost,
			// TODO: copy other values from the connectConfig
			gitHubClientId: gitHubAppConfig.client_id,
			gitHubClientSecret: gitHubAppConfig.client_secret,
			webhookSecret: gitHubAppConfig.webhook_secret,
			privateKey:  gitHubAppConfig.pem,
			installationId: res.locals.installation.id
		}, res.locals.jiraHost);

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.AutoCreateGitHubServerAppTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise,
			success: true
		});

		res.redirect(`/github/${uuid}/configuration`);
	} catch (error) {
		const errorQueryParam = error.response.status === 422 ? Errors.MISSING_GITHUB_APP_NAME : "";
		req.log.error({ reason: error }, "Error during GitHub App manifest flow");
		/**
		 * The query parameters here are used for call to action `retry`
		 * `retryUrl` is the URL/the action of the button
		 * And the rest of the queryParameters are simply forwarded to the new `retryUrl`
		 */

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.AutoCreateGitHubServerAppTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise,
			success: false
		});

		res.redirect(`/error/${errorQueryParam}?retryUrl=/github-manifest`);
	}
};
