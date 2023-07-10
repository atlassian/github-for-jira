import { Request } from "express";
import crypto from "crypto";
import { envVars } from "config/env";
import { GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { GetRedirectUrlResponse } from "rest-interfaces/oauth-types";

const appUrl = envVars.APP_URL;
const OAUTH_CALLBACK_PATH = "/callback";

export const getRedirectUrl = (req: Request): GetRedirectUrlResponse => {
	let callbackPath, hostname, clientId;

	if (req.params.uuid) {
		/**
		 * This is for the GitHub enterprise flow, which is not being used for now,
		 * TODO: Fetch the hostname and clientId for the GitHubServerApp using the UUID
		 */
		callbackPath = `/github/${req.params.uuid}${OAUTH_CALLBACK_PATH}`;
	} else {
		callbackPath = `/github${OAUTH_CALLBACK_PATH}`;
		hostname = GITHUB_CLOUD_BASEURL;
		clientId = envVars.GITHUB_CLIENT_ID;
	}
	const scopes = [ "user", "repo" ];
	const callbackURI = `${appUrl}${callbackPath}`;
	const state = crypto.randomBytes(8).toString("hex");

	return {
		redirectUrl: `${hostname}/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes.join(" "))}&redirect_uri=${encodeURIComponent(callbackURI)}&state=${state}`
	};
};
