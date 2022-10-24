import { Request, Response } from "express";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { Installation } from "~/src/models/installation";
import { Errors } from "config/errors";
import { createAnonymousClient } from "utils/get-github-client-config";

export const GithubManifestCompleteGet = async (req: Request, res: Response) => {
	const uuid = req.params.uuid;
	const jiraHost = res.locals.jiraHost;
	if (!jiraHost) {
		throw new Error("Jira Host not found");
	}
	const gheHost = req.session.temp?.gheHost;
	if (!gheHost) {
		throw new Error("GitHub Enterprise Host not found");
	}
	const installation = await Installation.getForHost(jiraHost);
	if (!installation) {
		throw new Error(`No Installation found for ${jiraHost}`);
	}
	if (!req.query.code) {
		throw new Error("No code was provided");
	}

	try {
		const gitHubClient = await createAnonymousClient(gheHost, jiraHost, req.log);
		const gitHubAppConfig = await gitHubClient.createGitHubApp('' + req.query.code);
		await GitHubServerApp.install({
			uuid,
			appId: gitHubAppConfig.id,
			gitHubAppName: gitHubAppConfig.name,
			gitHubBaseUrl: gheHost,
			gitHubClientId: gitHubAppConfig.client_id,
			gitHubClientSecret: gitHubAppConfig.client_secret,
			webhookSecret: gitHubAppConfig.webhook_secret,
			privateKey:  gitHubAppConfig.pem,
			installationId: installation.id
		});
		req.session.temp = undefined;
		res.redirect(`/github/${uuid}/configuration`);
	} catch (error) {
		const errorQueryParam = error.response.status === 422 ? Errors.MISSING_GITHUB_APP_NAME : "";
		req.log.error({ reason: error }, "Error during GitHub App manifest flow");
		/**
		 * The query parameters here are used for call to action `retry`
		 * `retryUrl` is the URL/the action of the button
		 * And the rest of the queryParameters are simply forwarded to the new `retryUrl`
		 */
		res.redirect(`/error/${errorQueryParam}?retryUrl=/session&baseUrl=${gheHost}&ghRedirect=to&autoApp=1`);
	}
};
