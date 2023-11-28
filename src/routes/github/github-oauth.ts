import crypto from "crypto";
import url from "url";
import { NextFunction, Request, Response } from "express";
import { envVars } from "config/env";
import { Errors, UIDisplayableError } from "config/errors";
import { createAnonymousClientByGitHubAppId } from "~/src/util/get-github-client-config";
import { createHashWithSharedSecret } from "utils/encryption";
import { GitHubServerApp } from "models/github-server-app";
import { GitHubAppConfig } from "~/src/sqs/sqs.types";
import Logger from "bunyan";
import * as querystring from "querystring";
import { Installation } from "models/installation";

const appUrl = envVars.APP_URL;
export const OAUTH_CALLBACK_SUBPATH = "/callback";
const callbackPathCloud = `/github${OAUTH_CALLBACK_SUBPATH}`;
const callbackPathServer = `/github/<uuid>${OAUTH_CALLBACK_SUBPATH}`;

interface OAuthState {
	postLoginRedirectUrl: string;
	installationIdPk: number;
	// Even though it is duplicated in the path, we should use it from session. The OAuth callback is a continuation of the
	// flow, therefore we should resume exactly at the place where we stopped without bringing anything extra from the
	// requests (except of what we have received from GitHub)
	gitHubServerUuid?: string;
	gitHubClientId: string;
}

const getRedirectUrl = async (res: Response, state: string) => {
	let callbackPath = callbackPathCloud;
	if (res.locals?.gitHubAppConfig?.uuid) {
		callbackPath = callbackPathServer.replace("<uuid>", res.locals.gitHubAppConfig.uuid);
	}
	const scopes = ["user", "repo"];

	const hostname: string = res.locals.gitHubAppConfig.hostname;
	const clientId: string = res.locals.gitHubAppConfig.clientId;
	const callbackURI = `${appUrl}${callbackPath}`;
	return `${hostname}/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes.join(" "))}&redirect_uri=${encodeURIComponent(callbackURI)}&state=${state}`;
};

export const GithubOAuthLoginGet = async (req: Request, res: Response): Promise<void> => {
	// TODO: We really should be using an Auth library for this, like @octokit/github-auth
	// Create unique state for each oauth request
	const stateKey = crypto.randomBytes(8).toString("hex");

	req.session["timestamp_before_oauth"] = Date.now();

	const parsedOriginalUrl = url.parse(req.originalUrl);

	const state: OAuthState = {
		postLoginRedirectUrl: res.locals.redirect ||
		`/github/configuration${parsedOriginalUrl.search || ""}`,
		installationIdPk: res.locals.installation.id,
		gitHubServerUuid: res.locals.gitHubAppConfig.uuid,
		gitHubClientId: res.locals.gitHubAppConfig.clientId
	};

	// The flow is interrupted here, but we have stored the state to a secure storage (session),
	// therefore we can continue from /callback where we stopped at without any concerns, as long as we use only
	// data from this state/session!
	req.session[stateKey] = state;

	const redirectUrl = await getRedirectUrl(res, stateKey);
	req.log.info("redirectUrl:", redirectUrl);

	req.log.info({
		redirectUrl,
		postLoginUrl: req.session[stateKey].postLoginRedirectUrl
	}, `Received request for ${req.url}, redirecting to Github OAuth flow`);
	req.log.debug(`redirecting to ${redirectUrl}`);
	res.redirect(redirectUrl);
};

/*
 * @return redirectUrl if succeeds
 */
const finishOAuthFlow = async (
	stateKey: string,
	secureState: OAuthState,
	code: string,
	log: Logger,
	respondWithError: (status: number, msg: string) => void,
	populateSession: (gitHubToken: string, gitHubRefreshToke: string | undefined, gitHubServerUuid?: string) => void
) => {
	const jiraHost = (await Installation.findByPk(secureState.installationIdPk))?.jiraHost;
	if (!jiraHost) {
		return respondWithError(400, "No installation found");
	}

	log.info({ jiraHost }, "Jira Host attempting to auth with GitHub");
	log.debug(`extracted jiraHost from redirect url: ${jiraHost}`);

	const gitHubClientSecret = await getCloudOrGHESAppClientSecret(secureState.gitHubServerUuid, jiraHost);
	if (!gitHubClientSecret) {
		return respondWithError(400, "Missing GitHubApp client secret from uuid");
	}

	log.info(`${createHashWithSharedSecret(gitHubClientSecret)} is used`);

	try {
		const metrics = {
			trigger: "oauth"
		};
		const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(
			secureState.gitHubServerUuid
				? (await GitHubServerApp.findForUuid(secureState.gitHubServerUuid))?.id : undefined,
			jiraHost, metrics, log
		);

		const exchangeGitHubToken = await gitHubAnonymousClient.exchangeGitHubToken({
			clientId: secureState.gitHubClientId, clientSecret: gitHubClientSecret, code, state: stateKey
		});

		if (!exchangeGitHubToken) {
			return respondWithError(400, `didn't get access token from GitHub`);
		}

		const { accessToken, refreshToken } = exchangeGitHubToken;
		populateSession(accessToken, refreshToken, secureState.gitHubServerUuid);

		log.debug(`got access token from GitHub, redirecting to ${secureState.postLoginRedirectUrl}`);

		log.info({ redirectUrl: secureState.postLoginRedirectUrl }, "Github OAuth code valid, redirecting to internal URL");
		return secureState.postLoginRedirectUrl;
	} catch (err: unknown) {
		log.warn({ err }, `Cannot retrieve access token from Github`);
		return respondWithError(401, "Cannot retrieve access token from Github");
	}
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
		next(new UIDisplayableError(400, `OAuth Error: URL: ${error_uri} ${error_description}`));
		return;
	}

	// Restore the state of the flow where we stopped in GitHubOAuthLoginGet and continue.
	// DO NOT RELY ON ANY REQUEST PARAMS (other than received from GitHub that we will validate) to make sure
	// we stay secure! We are just resuming the flow interrupted earlier and we can rely only to values from this state.
	const secureState = req.session[stateKey] as OAuthState;

	if (!secureState) {
		req.log.warn("No state found");
		next(new UIDisplayableError(400, "No state was found"));
		return;
	}
	// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
	delete req.session[stateKey];

	req.log.info({ query: req.query }, `Received request to ${req.url}`);

	if (!code) {
		req.log.warn("No code was found");
		next(new UIDisplayableError(400, "No code was found"));
	}

	// Wrapping into a function to make sure it doesn't have direct access to raw "req" object, passing over only the "secure" state
	const maybeRedirectUrl = await finishOAuthFlow(
		stateKey, secureState, code, req.log,

		(status: number, message: string) => {
			req.log.warn(message);
			res.status(status).send(message);
		},

		(gitHubToken: string, gitHubRefreshToken: string | undefined, gitHubServerUuid?: string) => {
			req.session.githubToken = gitHubToken;
			req.session.githubRefreshToken = gitHubRefreshToken;
			req.session.gitHubUuid = gitHubServerUuid;
		}
	);

	if (maybeRedirectUrl) {
		res.redirect(maybeRedirectUrl);
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

			delete query.resetGithubToken;

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
		const gitHubAnonymousClient = await createAnonymousClientByGitHubAppId(gitHubAppConfig.gitHubAppId, jiraHost, metrics, req.log);
		await gitHubAnonymousClient.checkGitHubToken(githubToken);

		req.log.debug(`Github token is valid, continuing...`);

		// Everything's good, set it to res.locals
		res.locals.githubToken = githubToken;
		return next();
	} catch (err: unknown) {
		req.log.info({ err }, `Github token is not valid.`);
		if (req.session?.githubRefreshToken) {
			req.log.debug(`Trying to renew Github token...`);
			const token = await renewGitHubToken(req.session.githubRefreshToken, res.locals.gitHubAppConfig, res.locals.jiraHost, req.log);
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
	} catch (err: unknown) {
		logger.warn({ err }, "Failed to renew Github token...");
	}
	logger.debug("Failed to renew Github token...");
	return undefined;
};
