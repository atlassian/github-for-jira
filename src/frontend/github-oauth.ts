import crypto from "crypto";
import url from "url";
import express, { NextFunction, Request, RequestHandler, Response, Router } from "express";
import axios from "axios";
import { getJiraHostFromRedirectUrl } from "../util/getUrl";
import { getLogger } from "../config/logger";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { Tracer } from "../config/tracer";

const host = process.env.GHE_HOST || "github.com";
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
		const tracer = new Tracer(logger.child(opts), "login", traceLogsEnabled)

		// TODO: We really should be using an Auth library for this, like @octokit/github-auth
		// Create unique state for each oauth request
		const state = crypto.randomBytes(8).toString("hex");

		req.session["timestamp_before_oauth"] = new Date().getTime();

		// Save the redirect that may have been specified earlier into session to be retrieved later
		req.session[state] =
			res.locals.redirect ||
			`/github/configuration${url.parse(req.originalUrl).search || ""}`;
		const redirectUrl = `https://${host}/login/oauth/authorize?client_id=${opts.githubClient}${
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
		const tracer = new Tracer(logger.child(opts), "callback", traceLogsEnabled)

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

		const jiraHost = getJiraHostFromRedirectUrl(redirectUrl, req.log);
		req.log.info({ jiraHost }, "Jira Host attempting to auth with GitHub");
		tracer.trace(`extracted jiraHost from redirect url: ${jiraHost}`);

		try {
			const response = await axios.get(
				`https://${host}/login/oauth/access_token`,
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

			req.session.githubToken = response.data.access_token;

			if (!req.session.githubToken) {
				tracer.trace(`didn't get access token from GitHub`);
				return next(new Error("Missing Access Token from Github OAuth Flow."));
			}

			tracer.trace(`got access token from GitHub, redirecting to ${redirectUrl}`);

			req.log.info({ redirectUrl }, "Github OAuth code valid, redirecting to internal URL");
			return res.redirect(redirectUrl);
		} catch (e) {
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
			const traceLogsEnabled = await booleanFlag(BooleanFlags.TRACE_LOGGING, false);
			const tracer = new Tracer(logger.child(opts), "checkGithubAuth", traceLogsEnabled)

			if (!req.session.githubToken) {
				tracer.trace("found github token in session, calling login()");
				res.locals.redirect = req.originalUrl;
				return login(req, res);
			}
			tracer.trace("found github token in session");
			return next();
		}
	};
};
