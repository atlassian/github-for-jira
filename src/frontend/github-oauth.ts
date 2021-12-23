import crypto from "crypto";
import url from "url";
import express, { NextFunction, Request, RequestHandler, Response, Router } from "express";
import axios from "axios";
import { getLogger } from "../config/logger";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { Tracer } from "../config/tracer";
import envVars from "../config/env";
import GithubApi from "../config/github-api";
import { Errors } from "../config/errors";

const logger = getLogger("github-oauth");

export interface OAuthOptions {
	baseURL: string;
	githubClient: string;
	githubSecret: string;
	loginURI?: string;
	callbackURI?: string;
	scopes?: string[];
}

export interface GithubOAuth {
	router: Router;
	checkGithubAuth: RequestHandler;
}

export default (opts: OAuthOptions): GithubOAuth => {
	opts.callbackURI = opts.callbackURI || "/github/callback";
	opts.loginURI = opts.loginURI || "/github/login";
	opts.scopes = opts.scopes || ["user", "repo"];
	const redirectURI = new URL(opts.callbackURI, opts.baseURL).toString();

	logger.info(opts, "Configuring github auth");

	async function login(req: Request, res: Response): Promise<void> {

		const traceLogsEnabled = await booleanFlag(BooleanFlags.TRACE_LOGGING, false);
		const tracer = new Tracer(logger.child(opts), "login", traceLogsEnabled);

		// TODO: We really should be using an Auth library for this, like @octokit/github-auth
		// Create unique state for each oauth request
		const state = crypto.randomBytes(8).toString("hex");

		req.session["timestamp_before_oauth"] = new Date().getTime();

		// Save the redirect that may have been specified earlier into session to be retrieved later
		req.session[state] =
			res.locals.redirect ||
			`/github/configuration${url.parse(req.originalUrl).search || ""}`;
		const redirectUrl = `https://${envVars.GITHUB_HOSTNAME}/login/oauth/authorize?client_id=${opts.githubClient}${
			opts.scopes?.length ? `&scope=${opts.scopes.join(" ")}` : ""
		}&redirect_uri=${redirectURI}&state=${state}`;
		req.log.info({
			redirectUrl,
			postLoginUrl: req.session[state]
		}, `Received request for ${opts.loginURI}, redirecting to Github OAuth flow`);
		tracer.trace(`redirecting to ${redirectUrl}`);
		res.redirect(redirectUrl);
	}

	async function callback(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		const {
			error,
			error_description,
			error_uri,
			code,
			state
		} = req.query as Record<string, string>;

		const traceLogsEnabled = await booleanFlag(BooleanFlags.TRACE_LOGGING, false);
		const tracer = new Tracer(logger.child(opts), "callback", traceLogsEnabled);

		const timestampBefore = req.session["timestamp_before_oauth"] as number;
		if (timestampBefore) {
			const timestampAfter = new Date().getTime();
			tracer.trace(`callback called after spending ${timestampAfter - timestampBefore} ms on GitHub servers`);
		}

		// Show the oauth error if there is one
		if (error) {
			tracer.trace(`OAuth Error: ${error}`);
			return next(`OAuth Error: ${error}
      URL: ${error_uri}
      ${error_description}`);
		}

		// Take save redirect url and delete it from session
		const redirectUrl = req.session[state] as string;
		delete req.session[state];

		tracer.trace(`extracted redirectUrl from session: ${redirectUrl}`);
		req.log.info({ query: req.query }, `Received request to ${opts.callbackURI}`);

		// Check if state is available and matches a previous request
		if (!state || !redirectUrl) return next("Missing matching Auth state parameter");
		if (!code) return next("Missing OAuth Code");

		const { jiraHost } = res.locals;

		req.log.info({ jiraHost }, "Jira Host attempting to auth with GitHub");
		tracer.trace(`extracted jiraHost from redirect url: ${jiraHost}`);

		try {
			const response = await axios.get(
				`https://${envVars.GITHUB_HOSTNAME}/login/oauth/access_token`,
				{
					params: {
						client_id: opts.githubClient,
						client_secret: opts.githubSecret,
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

			if (!req.session.githubToken) {
				tracer.trace(`didn't get access token from GitHub`);
				return next(new Error("Missing Access Token from Github OAuth Flow."));
			}

			tracer.trace(`got access token from GitHub, redirecting to ${redirectUrl}`);

			req.log.info({ redirectUrl }, "Github OAuth code valid, redirecting to internal URL");
			return res.redirect(redirectUrl);
		} catch (e) {
			tracer.trace(`Cannot retrieve access token from Github`);
			return next(new Error("Cannot retrieve access token from Github"));
		}
	}

	const router = express.Router();
	// compatible with flatiron/director
	router.get(opts.loginURI, login);
	router.get(opts.callbackURI, callback);

	return {
		router: router,
		checkGithubAuth: async (req: Request, res: Response, next: NextFunction) => {
			try {
				const { githubToken } = req.session;
				if (!githubToken) {
					req.log.info("github token missing, calling login()");
					throw "Missing github token";
				}
				req.log.debug("found github token in session. validating token with API.");

				await axios.get(`https://api.${envVars.GITHUB_HOSTNAME}`, {
					headers: {
						Authorization: `Bearer ${githubToken}`
					}
				});

				req.log.debug(`Github token is valid, continuing...`);

				// Everything's good, set it to res.locals
				res.locals.githubToken = githubToken;
				// TODO: Not a great place to put this, but it'll do for now
				res.locals.github = GithubApi({ auth: githubToken });
				return next();
			} catch (e) {
				req.log.debug(`Github token is not valid.`);
				// If it's a GET request, we can redirect to login and try again
				if (req.method == "GET") {
					req.log.info(`Trying to get new Github token...`);
					res.locals.redirect = req.originalUrl;
					return login(req, res);
				}

				// For any other requests, it should just error
				return res.status(401).send(Errors.MISSING_GITHUB_TOKEN);
			}
		}
	};
};
