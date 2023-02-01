import crypto from "crypto";
import url from "url";
import { NextFunction, Request, Response, Router } from "express";
import axios from "axios";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { Errors } from "config/errors";
import { getGitHubApiUrl, createAnonymousClientByGitHubAppId } from "~/src/util/get-github-client-config";
import { createHashWithSharedSecret } from "utils/encryption";
import { BooleanFlags, booleanFlag } from "config/feature-flags";
import { GitHubServerApp } from "models/github-server-app";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { GitHubAppConfig } from "~/src/sqs/sqs.types";
import Logger from "bunyan";

const logger = getLogger("github-oauth");
const appUrl = envVars.APP_URL;
const scopes = ["user", "repo"];
const callbackSubPath = "/callback";
const callbackPathCloud = `/github${callbackSubPath}`;
const callbackPathServer = `/github/<uuid>${callbackSubPath}`;

const getRedirectUrl = async (res, state) => {
	// TODO: revert this logic and calculate redirect URL from req once create branch supports JWT and GitHubAuthMiddleware is a router-level middleware again
	let callbackPath = callbackPathCloud;
	if (res.locals?.gitHubAppConfig?.uuid) {
		callbackPath = callbackPathServer.replace("<uuid>", res.locals.gitHubAppConfig.uuid);
	}

	const { hostname, clientId } = res.locals.gitHubAppConfig;
	const callbackURI = `${appUrl}${callbackPath}`;
	return `${hostname}/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes.join(" "))}&redirect_uri=${encodeURIComponent(callbackURI)}&state=${state}`;
};

const GithubOAuthLoginGet = async (req: Request, res: Response): Promise<void> => {
	// TODO: We really should be using an Auth library for this, like @octokit/github-auth
	// Create unique state for each oauth request
	const state = crypto.randomBytes(8).toString("hex");

	req.session["timestamp_before_oauth"] = Date.now();

	// Save the redirect that may have been specified earlier into session to be retrieved later
	req.session[state] =
		appendJiraHostIfNeeded(res.locals.redirect ||
		`/github/configuration${url.parse(req.originalUrl).search || ""}`, res.locals.jiraHost);
	// Find callback URL based on current url of this route
	const redirectUrl = await getRedirectUrl(res, state);
	req.log.info("redirectUrl:", redirectUrl);

	req.log.info({
		redirectUrl,
		postLoginUrl: req.session[state]
	}, `Received request for ${req.url}, redirecting to Github OAuth flow`);
	req.log.debug(`redirecting to ${redirectUrl}`);
	res.redirect(redirectUrl);
};

const GithubOAuthCallbackGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		error,
		error_description,
		error_uri,
		code,
		state
	} = req.query as Record<string, string>;

	const timestampBefore = req.session["timestamp_before_oauth"] as number;
	if (timestampBefore) {
		const timestampAfter = Date.now();
		req.log.debug(`callback called after spending ${timestampAfter - timestampBefore} ms on GitHub servers`);
	}

	// Show the oauth error if there is one
	if (error) {
		req.log.debug(`OAuth Error: ${error}`);
		return next(`OAuth Error: ${error}
      URL: ${error_uri}
      ${error_description}`);
	}

	// Take save redirect url and delete it from session
	const redirectUrl = req.session[state] as string;
	delete req.session[state];

	req.log.debug(`extracted redirectUrl from session: ${redirectUrl}`);
	req.log.info({ query: req.query }, `Received request to ${req.url}`);

	// Check if state is available and matches a previous request
	if (!state || !redirectUrl) return next("Missing matching Auth state parameter");
	if (!code) return next("Missing OAuth Code");

	const { jiraHost, gitHubAppConfig } = res.locals;
	const { hostname, clientId, uuid } = gitHubAppConfig;
	req.log.info({ jiraHost }, "Jira Host attempting to auth with GitHub");
	req.log.debug(`extracted jiraHost from redirect url: ${jiraHost}`);

	const gitHubClientSecret = await getCloudOrGHESAppClientSecret(gitHubAppConfig, jiraHost);
	if (!gitHubClientSecret) return next("Missing GitHubApp client secret from uuid");

	logger.info(`${createHashWithSharedSecret(gitHubClientSecret)} is used`);


	try {

		if (await booleanFlag(BooleanFlags.USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER, jiraHost)) {
			const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(gitHubAppConfig.gitHubAppId, jiraHost, logger);
			const { accessToken, refreshToken } = await gitHubAnonymousClient.exchangeGitHubToken({
				clientId, clientSecret: gitHubClientSecret, code, state
			});
			req.session.githubToken = accessToken;
			req.session.githubRefreshToken = refreshToken;
		} else {
			const response = await axios.get(
				`${hostname}/login/oauth/access_token`,
				{
					params: {
						client_id: clientId,
						client_secret: gitHubClientSecret,
						code,
						state
					},
					headers: {
						accept: "application/json",
						"content-type": "application/json"
					},
					responseType: "json"
				}
			);
			// Saving it to session be used later
			req.session.githubToken = response.data.access_token;
			req.session.githubRefreshToken = response.data.refresh_token;
		}

		// Saving UUID for each GitHubServerApp
		req.session.gitHubUuid = uuid;

		if (!req.session.githubToken) {
			req.log.debug(`didn't get access token from GitHub`);
			return next(new Error("Missing Access Token from Github OAuth Flow."));
		}

		req.log.debug(`got access token from GitHub, redirecting to ${redirectUrl}`);

		req.log.info({ redirectUrl }, "Github OAuth code valid, redirecting to internal URL");
		return res.redirect(redirectUrl);
	} catch (e) {
		req.log.debug(`Cannot retrieve access token from Github`);
		return next(new Error("Cannot retrieve access token from Github"));
	}
};

export const GithubAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { githubToken, gitHubUuid } = req.session;
		const { jiraHost, gitHubAppConfig } = res.locals;
		const gitHubAppId = res.locals.gitHubAppId || gitHubAppConfig.gitHubAppId;

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

		if (await booleanFlag(BooleanFlags.USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER, jiraHost)) {
			const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(gitHubAppConfig.gitHubAppId, jiraHost, logger);
			await gitHubAnonymousClient.checkGitHubToken(githubToken);
		} else {
			const url = await getGitHubApiUrl(jiraHost, gitHubAppId, req.log);
			await axios.get(url, {
				headers: {
					Authorization: `Bearer ${githubToken}`
				}
			});
		}

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
		return res.status(401).send(Errors.MISSING_GITHUB_TOKEN);
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

const TempGetJiraHostFromStateMiddleware  = async (req: Request, res: Response, next: NextFunction) => {

	const stateKey = req.query.state as string;
	if (!stateKey) {
		req.log.warn("State key is empty");
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return;
	}
	if (!req.session[stateKey]) {
		req.log.warn("State is empty in req.session for callback redirect");
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return;
	}

	let url;
	try {
		let redirectUrl = req.session[stateKey];
		if (!redirectUrl.startsWith("http")) {
			redirectUrl = "https://dummy.domain" + redirectUrl;
		}
		url = new URL(redirectUrl);
	} catch (e) {
		req.log.warn("Error passing redirect url in callback", e);
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return;
	}
	const jiraHost = url.searchParams.get("jiraHost");
	if (!jiraHost) {
		req.log.warn("jiraHost is missing in state redirect uri");
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return;
	}

	res.locals.jiraHost = jiraHost;
	next();
};

const appendJiraHostIfNeeded = (url: string, jiraHost: string): string => {
	if (!jiraHost) return url;
	if (url.indexOf("?") === -1) url = url + "?";
	if (url.indexOf("&jiraHost") === -1) url = url + "&jiraHost=" + jiraHost;
	return url;
};

const renewGitHubToken = async (githubRefreshToken: string, gitHubAppConfig: GitHubAppConfig, jiraHost: string, logger: Logger) => {
	try {
		const clientSecret = await getCloudOrGHESAppClientSecret(gitHubAppConfig, jiraHost);
		if (clientSecret) {
			const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(gitHubAppConfig?.gitHubAppId, jiraHost, logger);
			const { accessToken, refreshToken } = await gitHubAnonymousClient.renewGitHubToken({
				refreshToken: githubRefreshToken,
				clientId: gitHubAppConfig.clientId,
				clientSecret
			});
			return { accessToken, refreshToken };
		}
	} catch (err) {
		logger.warn({ err }, "Failed to renew Github token...");
	}
	logger.debug("Failed to renew Github token...");
	return undefined;
};

// IMPORTANT: We need to keep the login/callback/middleware functions
// in the same file as they reference each other
export const GithubOAuthRouter = Router({ mergeParams: true });
GithubOAuthRouter.get("/login", GithubServerAppMiddleware, GithubOAuthLoginGet);
GithubOAuthRouter.get(callbackSubPath, TempGetJiraHostFromStateMiddleware, GithubServerAppMiddleware, GithubOAuthCallbackGet);
