import { envVars } from "config/env";
import { GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { GetRedirectUrlResponse } from "rest-interfaces/oauth-types";

const appUrl = envVars.APP_URL;

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
	const callbackURI = `${appUrl}${callbackPath}`;

	return {
		redirectUrl: `${hostname}/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes.join(" "))}&redirect_uri=${encodeURIComponent(callbackURI)}`
	};
};
