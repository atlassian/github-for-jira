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

const logger = getLogger("github-oauth");
const appUrl = envVars.APP_URL;
const scopes = ["user", "repo"];
const callbackPath = "/callback";

const getRedirectUrl = async (req, res, state) => {
	const { baseUrl } = req;
	const { hostname, clientId } = res.locals.gitHubAppConfig;
	const callbackURI = `${appUrl}${baseUrl}${callbackPath}`;
	return `${hostname}/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes.join(" "))}&redirect_uri=${encodeURIComponent(callbackURI)}&state=${state}`;
};

const GithubOAuthLoginGet = async (req: Request, res: Response): Promise<void> => {
	// TODO: We really should be using an Auth library for this, like @octokit/github-auth
	// Create unique state for each oauth request
	const state = crypto.randomBytes(8).toString("hex");

	req.session["timestamp_before_oauth"] = Date.now();

	// Save the redirect that may have been specified earlier into session to be retrieved later
	req.session[state] =
		res.locals.redirect ||
		`/github/configuration${url.parse(req.originalUrl).search || ""}`;
	// Find callback URL based on current url of this route
	const redirectUrl = await getRedirectUrl(req, res, state);
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
	const { hostname, clientId, gitHubClientSecret, uuid } = gitHubAppConfig;
	req.log.info({ jiraHost }, "Jira Host attempting to auth with GitHub");
	req.log.debug(`extracted jiraHost from redirect url: ${jiraHost}`);

	logger.info(`${createHashWithSharedSecret(gitHubClientSecret)} is used`);


	try {

		if (await booleanFlag(BooleanFlags.USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER, false, jiraHost)) {
			try {
				logger.info(`USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER is true, begin use anonymouse client for exchange access_token`);
				const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(gitHubAppConfig.gitHubAppId, jiraHost, logger);
				const accessToken = await gitHubAnonymousClient.exchangeGitHubToken({
					clientId, clientSecret: gitHubClientSecret, code, state
				});
				req.session.githubToken = accessToken;
				logger.info(`USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER is true, success use anonymouse client for exchange access_token`);
			} catch (e) {
				logger.error(`USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER is true, fail use anonymouse client for exchange access_token`, e);
				throw e;
			}
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

		if (await booleanFlag(BooleanFlags.USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER, false, jiraHost)) {
			try {
				logger.info(`USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER is true, begin use anonymouse client for checking github token is valid`);
				const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(gitHubAppConfig.gitHubAppId, jiraHost, logger);
				await gitHubAnonymousClient.checkGitHubToken(githubToken);
				logger.info(`USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER is true, success use anonymouse client for checking github token is valid`);
			} catch (e) {
				logger.error(`USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER is true, fail use anonymouse client for checking github token is valid`, e);
				throw e;
			}
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
		// If it's a GET request, we can redirect to login and try again
		if (req.method == "GET") {
			req.log.debug(`Trying to get new Github token...`);
			res.locals.redirect = req.originalUrl;
			return GithubOAuthLoginGet(req, res);
		}

		// For any other requests, it should just error
		return res.status(401).send(Errors.MISSING_GITHUB_TOKEN);
	}
};

// IMPORTANT: We need to keep the login/callback/middleware functions
// in the same file as they reference each other
export const GithubOAuthRouter = Router();
GithubOAuthRouter.get("/login", GithubOAuthLoginGet);
GithubOAuthRouter.get(callbackPath, GithubOAuthCallbackGet);
