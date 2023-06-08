import crypto from "crypto";
import url from "url";
import { NextFunction, Request, Response } from "express";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { Errors } from "config/errors";
import { createAnonymousClientByGitHubAppId } from "~/src/util/get-github-client-config";
import { createHashWithSharedSecret } from "utils/encryption";
import { GitHubServerApp } from "models/github-server-app";
import { GitHubAppConfig } from "~/src/sqs/sqs.types";
import Logger from "bunyan";
import { stringFlag, StringFlags } from "config/feature-flags";
import * as querystring from "querystring";
import { Installation } from "models/installation";

const logger = getLogger("github-oauth");
const appUrl = envVars.APP_URL;
export const OAUTH_CALLBACK_SUBPATH = "/callback";
const callbackPathCloud = `/github${OAUTH_CALLBACK_SUBPATH}`;
const callbackPathServer = `/github/<uuid>${OAUTH_CALLBACK_SUBPATH}`;

interface OAuthState {
	postLoginRedirectUrl: string;
	installationIdPk: number;
	gitHubServerUuid?: string;
	gitHubClientId: string;
}

const getRedirectUrl = async (res: Response, state: string) => {
	// TODO: revert this logic and calculate redirect URL from req once create branch supports JWT and GitHubAuthMiddleware is a router-level middleware again
	let callbackPath = callbackPathCloud;
	if (res.locals?.gitHubAppConfig?.uuid) {
		callbackPath = callbackPathServer.replace("<uuid>", res.locals.gitHubAppConfig.uuid);
	}

	const definedScopes = await stringFlag(StringFlags.GITHUB_SCOPES, "user,repo", res.locals.jiraHost);
	const scopes = definedScopes.split(",");

	const { hostname, clientId } = res.locals.gitHubAppConfig;
	const callbackURI = `${appUrl}${callbackPath}`;
	return `${hostname}/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes.join(" "))}&redirect_uri=${encodeURIComponent(callbackURI)}&state=${state}`;
};

export const GithubOAuthLoginGet = async (req: Request, res: Response): Promise<void> => {
	// TODO: We really should be using an Auth library for this, like @octokit/github-auth
	// Create unique state for each oauth request
	const stateKey = crypto.randomBytes(8).toString("hex");

	req.session["timestamp_before_oauth"] = Date.now();

	const parsedOriginalUrl = url.parse(req.originalUrl);
	// Save the redirect that may have been specified earlier into session to be retrieved later

	const state: OAuthState = {
		postLoginRedirectUrl: res.locals.redirect ||
		`/github/configuration${parsedOriginalUrl.search || ""}`,
		installationIdPk: res.locals.installation.id,
		gitHubServerUuid: res.locals.gitHubAppConfig.uuid,
		gitHubClientId: res.locals.gitHubAppConfig.gitHubClientId
	};

	req.session[stateKey] = state;

	// Find callback URL based on current url of this route
	const redirectUrl = await getRedirectUrl(res, stateKey);
	req.log.info("redirectUrl:", redirectUrl);

	req.log.info({
		redirectUrl,
		postLoginUrl: req.session[stateKey].postLoginRedirectUrl
	}, `Received request for ${req.url}, redirecting to Github OAuth flow`);
	req.log.debug(`redirecting to ${redirectUrl}`);
	res.redirect(redirectUrl);
};

export const GithubOAuthCallbackGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		error,
		error_description,
		error_uri,
		code,
		state: stateKey
	} = req.query as Record<string, string>;

	const timestampBefore = req.session["timestamp_before_oauth"] as number;
	if (timestampBefore) {
		const timestampAfter = Date.now();
		req.log.debug(`callback called after spending ${timestampAfter - timestampBefore} ms on GitHub servers`);
	}

	// Show the oauth error if there is one
	if (error) {
		req.log.warn(`OAuth Error: ${error}`);
		res.status(400).send(`OAuth Error: ${error}
      URL: ${error_uri}
      ${error_description}`);
		return;
	}

	// Take save redirect url and delete it from session
	const state = req.session[stateKey] as OAuthState;
	if (!state) {
		req.log.warn("No state found");
		res.status(400).send("No state was found");
		return;
	}
	delete req.session[stateKey];

	req.log.info({ query: req.query }, `Received request to ${req.url}`);

	if (!code) {
		req.log.warn("No code was found");
		res.status(400).send("No code was found");
		return;
	}

	const jiraHost = (await Installation.findByPk(state.installationIdPk))?.jiraHost;
	if (!jiraHost) {
		req.log.warn("No installation found");
		res.status(400).send("No installation found");
		return;
	}

	req.log.info({ jiraHost }, "Jira Host attempting to auth with GitHub");
	req.log.debug(`extracted jiraHost from redirect url: ${jiraHost}`);

	const gitHubClientSecret = await getCloudOrGHESAppClientSecret(state.gitHubServerUuid, jiraHost);
	if (!gitHubClientSecret) return next("Missing GitHubApp client secret from uuid");

	logger.info(`${createHashWithSharedSecret(gitHubClientSecret)} is used`);

	try {

		const metrics = {
			trigger: "oauth"
		};
		const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(
			state.gitHubServerUuid
				? (await GitHubServerApp.findForUuid(state.gitHubServerUuid))?.id : undefined,
			jiraHost, metrics, logger
		);
		const { accessToken, refreshToken } = await gitHubAnonymousClient.exchangeGitHubToken({
			clientId: state.gitHubClientId, clientSecret: gitHubClientSecret, code, state: stateKey
		});
		req.session.githubToken = accessToken;
		req.session.githubRefreshToken = refreshToken;

		// Saving UUID for each GitHubServerApp
		req.session.gitHubUuid = uuid;

		if (!req.session.githubToken) {
			req.log.debug(`didn't get access token from GitHub`);
			return next(new Error("Missing Access Token from Github OAuth Flow."));
		}

		req.log.debug(`got access token from GitHub, redirecting to ${state.postLoginRedirectUrl}`);

		req.log.info({ redirectUrl: state.postLoginRedirectUrl }, "Github OAuth code valid, redirecting to internal URL");
		return res.redirect(state.postLoginRedirectUrl);
	} catch (e) {
		req.log.debug(`Cannot retrieve access token from Github`);
		return next(new Error("Cannot retrieve access token from Github"));
	}
};

const queryToQueryString = (query) =>
	querystring.stringify(Object.fromEntries(
		Object.entries(query).map(([key, value]) => [key, String(value)])
	));

export const GithubAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { query, originalUrl } = req;
		if (query && query["resetGithubToken"]) {
			req.session.githubToken = undefined;
			req.session.githubRefreshToken = undefined;

			delete query["resetGithubToken"];

			const newUrl = originalUrl.split("?")[0] + "?" + queryToQueryString(query);
			req.log.info("Github Token reset for URL: ", newUrl);
			return res.redirect(newUrl);
		}

		const { githubToken, gitHubUuid } = req.session;
		const { jiraHost, gitHubAppConfig } = res.locals;

		/**
		 * Comparing the `UUID` saved in the session with the `UUID` inside `gitHubAppConfig`,
		 * to trigger another GitHub Login and fetch new githubToken.
		 * This is done because the `user/installations` endpoint is based upon the githubToken
		 * and to fetch new list of installations we need separate githubTokens
		 */
		if (!githubToken || gitHubUuid !== gitHubAppConfig.uuid) {
			req.log.info("github token missing, calling login()");
			throw "Missing github token";
		}
		req.log.debug("found github token in session. validating token with API.");

		const metrics = {
			trigger: "oauth"
		};
		const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(gitHubAppConfig.gitHubAppId, jiraHost, metrics, logger);
		await gitHubAnonymousClient.checkGitHubToken(githubToken);

		req.log.debug(`Github token is valid, continuing...`);

		// Everything's good, set it to res.locals
		res.locals.githubToken = githubToken;
		return next();
	} catch (e) {
		req.log.debug(`Github token is not valid.`);
		if (req.session?.githubRefreshToken) {
			req.log.debug(`Trying to renew Github token...`);
			const token = await renewGitHubToken(req.session.githubRefreshToken, res.locals.gitHubAppConfig, res.locals.jiraHost, logger);
			if (token) {
				req.session.githubToken = token.accessToken;
				req.session.githubRefreshToken = token.refreshToken;
				res.locals.githubToken = token.accessToken;
				return next();
			}
		}
		if (req.method == "GET") {
			// If it's a GET request, we can redirect to login and try again
			req.log.debug(`Trying to get new Github token...`);
			res.locals.redirect = req.originalUrl;
			return GithubOAuthLoginGet(req, res);
		}

		// For any other requests, it should just error
		return res.status(401).json({ err: Errors.MISSING_GITHUB_TOKEN, errorCode: "MISSING_GITHUB_TOKEN" });
	}
};

const getCloudOrGHESAppClientSecret = async (serverUuid: string | undefined, jiraHost: string) => {

	if (!serverUuid) {
		return envVars.GITHUB_CLIENT_SECRET;
	}

	const ghesApp = await GitHubServerApp.findForUuid(serverUuid);
	if (!ghesApp) return undefined;

	return ghesApp.getDecryptedGitHubClientSecret(jiraHost);
};

const renewGitHubToken = async (githubRefreshToken: string, gitHubAppConfig: GitHubAppConfig, jiraHost: string, logger: Logger) => {
	logger.info("Trying to renewGitHubToken");
	try {
		const clientSecret = await getCloudOrGHESAppClientSecret(gitHubAppConfig.uuid, jiraHost);
		if (clientSecret) {
			const metrics = {
				trigger: "auth-middleware"
			};
			const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(gitHubAppConfig?.gitHubAppId, jiraHost, metrics, logger);
			const res = await gitHubAnonymousClient.renewGitHubToken(githubRefreshToken, gitHubAppConfig.clientId, clientSecret);
			return { accessToken: res.accessToken, refreshToken: res.refreshToken };
		}
	} catch (err) {
		logger.warn({ err }, "Failed to renew Github token...");
	}
	logger.debug("Failed to renew Github token...");
	return undefined;
};
