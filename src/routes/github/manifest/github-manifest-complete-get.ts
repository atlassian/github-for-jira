import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { Errors } from "config/errors";
import { createAnonymousClient } from "utils/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";

export const GithubManifestCompleteGet = async (req: Request<ParamsDictionary, unknown, unknown, { code: string }>, res: Response) => {
	const uuid = req.params.uuid;

	const tempStorage = new GheConnectConfigTempStorage();
	const connectConfig = await tempStorage.get(uuid, res.locals.installation.id);
	if (!connectConfig) {
		req.log.warn("No connect config found");
		res.sendStatus(404);
		return;
	}

	// Should never happen because temp storage uses random UUIDs, the chances of collision is super low. Keeping
	// just in case, though
	if (await GitHubServerApp.findForUuid(uuid)) {
		req.log.error({ connectConfigUuid: uuid }, "There's already GitHubServerApp with such UUID, halting");
		res.sendStatus(400);
		return;
	}

	if (!req.query.code) {
		req.log.warn("No code was provided");
		res.sendStatus(400);
		return;
	}

	try {
		const metrics = {
			trigger: "manifest"
		};
		const gitHubClient = await createAnonymousClient(connectConfig.serverUrl, res.locals.jiraHost, metrics, req.log,
			connectConfig.apiKeyHeaderName
				? {
					headerName: connectConfig.apiKeyHeaderName,
					apiKeyGenerator: () => GitHubServerApp.decrypt(res.locals.jiraHost, connectConfig.encryptedApiKeyValue || "")
				}
				: undefined
		);
		const gitHubAppConfig = await gitHubClient.createGitHubApp(req.query.code.toString());
		await GitHubServerApp.install({
			uuid,
			appId: gitHubAppConfig.id,
			gitHubAppName: gitHubAppConfig.name,
			gitHubBaseUrl: connectConfig.serverUrl,
			gitHubClientId: gitHubAppConfig.client_id,
			gitHubClientSecret: gitHubAppConfig.client_secret,
			webhookSecret: gitHubAppConfig.webhook_secret,
			privateKey:  gitHubAppConfig.pem,
			installationId: res.locals.installation.id,
			apiKeyHeaderName: connectConfig.apiKeyHeaderName,
			encryptedApiKeyValue: connectConfig.encryptedApiKeyValue
		}, res.locals.jiraHost);

		await tempStorage.delete(uuid, res.locals.installation.id);

		await sendAnalytics(res.locals.jiraHost, AnalyticsEventTypes.TrackEvent, {
			action: AnalyticsTrackEventsEnum.AutoCreateGitHubServerAppTrackEventName,
			actionSubject: AnalyticsTrackEventsEnum.AutoCreateGitHubServerAppTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise
		}, {
			withApiKey: !!connectConfig.apiKeyHeaderName,
			success: true
		});

		res.redirect(`/github/${uuid}/configuration`);
	} catch (err: unknown) {
		const error = err as { response?: { status?: number } };
		const errorQueryParam = error?.response?.status === 422 ? Errors.MISSING_GITHUB_APP_NAME : "";
		req.log.error({ reason: error }, "Error during GitHub App manifest flow");
		/**
		 * The query parameters here are used for call to action `retry`
		 * `retryUrl` is the URL/the action of the button
		 * And the rest of the queryParameters are simply forwarded to the new `retryUrl`
		 */

		await sendAnalytics(res.locals.jiraHost, AnalyticsEventTypes.TrackEvent, {
			action: AnalyticsTrackEventsEnum.AutoCreateGitHubServerAppTrackEventName,
			actionSubject: AnalyticsTrackEventsEnum.AutoCreateGitHubServerAppTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise
		}, {
			withApiKey: !!connectConfig.apiKeyHeaderName,
			success: false
		});

		res.redirect(`/error/${errorQueryParam}?retryUrl=/github-manifest`);
	}
};
