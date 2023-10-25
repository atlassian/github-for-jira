import { Request, Response } from "express";
import axios from "axios";
import { createAnonymousClientByGitHubAppId } from "~/src/util/get-github-client-config";
import { logCurlOutputInChunks, runCurl } from "utils/curl/curl-utils";
import { GithubClientError } from "~/src/github/client/github-client-errors";
import { envVars } from "config/env";

/**
 * Makes a call to the URL passed into the "url" field of the body JSON.
 */
export const ApiPingPost = async (req: Request, res: Response): Promise<void> => {

	const { data } = req.body;

	if (!data || !data.url) {
		res.status(400)
			.json({
				message: "Please provide a JSON object with the field 'url'."
			});
		return;
	}

	try {
		const output = await runCurl({
			fullUrl: data.url,
			method: "GET",
			authorization: "invalid-auth-token", //just to check tcp/ssl connection
			proxy: data.useProxy === true ? envVars.PROXY : undefined
		});
		logCurlOutputInChunks(output, req.log);
	} catch (e: unknown) {
		req.log.warn("Fail initiate ping url using curl", { err: e, url: data.url });
	}

	try {
		if (data.jiraHost) {
			const gitHubClient = await createAnonymousClientByGitHubAppId(data.gitHubAppId, data.jiraHost, { trigger: "api-ping-post" }, req.log);
			try {
				await gitHubClient.checkGitHubToken("invalid-token");
			} catch (e: unknown) {
				if (e instanceof GithubClientError) {
					req.log.warn("Anonymous client failed at GitHubClientError", { err: e, url: data.url, gitHubAppId: data.gitHubAppId, jiraHost: data.jiraHost });
				} else {
					throw e;
				}
			}
		}
	} catch (e: unknown) {
		req.log.warn("Cannot ping url using github anonymous client", { err: e, url: data.url, gitHubAppId: data.gitHubAppId, jiraHost: data.jiraHost });
	}

	try {
		const pingResponse = await axios.get(data.url);
		res.json({
			url: data.url,
			method: "GET",
			statusCode: pingResponse.status,
			statusText: pingResponse.statusText
		});
	} catch (err: unknown) {
		res.json({
			url: data.url,
			method: "GET",
			error: err
		});
	}
};
