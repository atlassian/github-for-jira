import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { createAnonymousClientByGitHubAppId } from "~/src/util/get-github-client-config";
import { createHashWithSharedSecret } from "utils/encryption";
import { GitHubServerApp } from "models/github-server-app";
import { stringFlag, StringFlags } from "config/feature-flags";

const logger = getLogger("github-oauth");
const appUrl = envVars.APP_URL;
const callbackSubPath = "/callback";
const callbackPathCloud = `/github${callbackSubPath}`;
const callbackPathServer = `/github/<uuid>${callbackSubPath}`;

const getRedirectUrl = async (jiraHost: string, gitHubAppConfig: { hostname: string, clientId: string, uuid?: string }, state: string) => {
	// TODO: revert this logic and calculate redirect URL from req once create branch supports JWT and is a router-level middleware again
	let callbackPath = callbackPathCloud;
	if (gitHubAppConfig.uuid) {
		callbackPath = callbackPathServer.replace("<uuid>", gitHubAppConfig.uuid);
	}

	const definedScopes = await stringFlag(StringFlags.GITHUB_SCOPES, "user,repo", jiraHost);
	const scopes = definedScopes.split(",");

	const { hostname, clientId } = gitHubAppConfig;
	const callbackURI = `${appUrl}${callbackPath}`;
	return `${hostname}/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes.join(" "))}&redirect_uri=${encodeURIComponent(callbackURI)}&state=${state}`;
};

/*
 * Just construct and return the url need for initiate GitHub Oauth flow
 */
export const GitHubOAuthInitiateUrlGet  = async (_req: Request, res: Response): Promise<void> => {
	const state = crypto.randomBytes(8).toString("hex") + "__api";
	const redirectUrl = await getRedirectUrl(res.locals.jiraHost, res.locals.gitHubAppConfig, state);
	res.json({ redirectUrl });
};

export const GithubOAuthTokenExchangeGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	const {
		error,
		error_description,
		error_uri,
		code,
		state
	} = req.query as Record<string, string>;

	// Show the oauth error if there is one
	if (error) {
		req.log.debug(`OAuth Error: ${error}`);
		return next(`OAuth Error: ${error}
      URL: ${error_uri}
      ${error_description}`);
	}

	if (!code) return next("Missing OAuth Code");

	const { jiraHost, gitHubAppConfig } = res.locals;
	const { clientId } = gitHubAppConfig;
	req.log.info({ jiraHost }, "Jira Host attempting to auth with GitHub");
	req.log.debug(`extracted jiraHost from redirect url: ${jiraHost}`);

	const gitHubClientSecret = await getCloudOrGHESAppClientSecret(gitHubAppConfig, jiraHost);
	if (!gitHubClientSecret) return next("Missing GitHubApp client secret from uuid");

	logger.info(`${createHashWithSharedSecret(gitHubClientSecret)} is used`);

	try {

		const metrics = {
			trigger: "oauth"
		};
		const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(gitHubAppConfig.gitHubAppId, jiraHost, metrics, logger);
		const { accessToken } = await gitHubAnonymousClient.exchangeGitHubToken({
			clientId, clientSecret: gitHubClientSecret, code, state
		});

		if (!accessToken) {
			req.log.debug(`didn't get access token from GitHub`);
			return next(new Error("Missing Access Token from Github OAuth Flow."));
		}

		res.json({ accessToken });

	} catch (e) {
		req.log.debug(`Cannot retrieve access token from Github`);
		return next(new Error("Cannot retrieve access token from Github"));
	}
};


const getCloudOrGHESAppClientSecret = async (gitHubAppConfig, jiraHost: string) => {

	if (!gitHubAppConfig.gitHubAppId) {
		return envVars.GITHUB_CLIENT_SECRET;
	}

	const ghesApp = await GitHubServerApp.findForUuid(gitHubAppConfig.uuid);
	if (!ghesApp) return undefined;

	return ghesApp.getDecryptedGitHubClientSecret(jiraHost);
};

