import Logger from "bunyan";
import { envVars } from "config/env";
import { GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { GetRedirectUrlResponse, ExchangeTokenResponse  } from "rest-interfaces/oauth-types";
import { createAnonymousClientByGitHubAppId } from "utils/get-github-client-config";

export const getRedirectUrl = async (gheUUID: string | undefined): Promise<GetRedirectUrlResponse> => {

	let callbackPath: string, hostname: string, clientId: string;

	if (gheUUID) {
		/**
		 * This is for the GitHub enterprise flow, which is not being used for now,
		 * TODO: Fetch the hostname and clientId for the GitHubServerApp using the UUID
		 */
		callbackPath = `/rest/app/${gheUUID}/github-callback`;
		hostname = "";
		clientId = "";
	} else {
		callbackPath = `/rest/app/cloud/github-callback`;
		hostname = GITHUB_CLOUD_BASEURL;
		clientId = envVars.GITHUB_CLIENT_ID;
	}
	const scopes = [ "user", "repo" ];
	const callbackURI = `${envVars.APP_URL}${callbackPath}`;

	return {
		redirectUrl: `${hostname}/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes.join(" "))}&redirect_uri=${encodeURIComponent(callbackURI)}`
	};
};

export const finishOAuthFlow = async (
	gheUUID: string | undefined,
	code: string,
	state: string,
	log: Logger
): Promise<ExchangeTokenResponse | null> => {

	if (!code) {
		log.warn("No code provided!");
		return null;
	}

	if (gheUUID) {
		log.warn("GHE not supported yet in rest oauth");
		return null;
	}

	try {

		const githubClient = await createAnonymousClientByGitHubAppId(
			undefined,
			undefined,
			{ trigger: "getAccessToken" },
			log
		);

		const { accessToken, refreshToken } = await githubClient.exchangeGitHubToken({
			clientId: envVars.GITHUB_CLIENT_ID,
			clientSecret: envVars.GITHUB_CLIENT_SECRET,
			code,
			state
		});

		return {
			accessToken,
			refreshToken
		};

	} catch (error) {
		log.warn({ error }, "Failed to acquire Github token...");
		return null;
	}
};
