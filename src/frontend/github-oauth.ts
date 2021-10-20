import crypto from "crypto";
import url from "url";
import express, { NextFunction, Request, RequestHandler, Response, Router } from "express";
import axios from "axios";
import { getJiraHostFromRedirectUrl, getJiraHostFromRedirectUrlNew } from "../util/getUrl";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { getLogger } from "../config/logger";

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

	function login(req: Request, res: Response): void {
		// TODO: We really should be using an Auth library for this, like @octokit/github-auth
		// Create unique state for each oauth request
		const state = crypto.randomBytes(8).toString("hex");

		// Save the redirect that may have been specified earlier into session to be retrieved later
		req.session[state] =
			res.locals.redirect ||
			`/github/configuration${url.parse(req.originalUrl).search || ""}`;
		const redirectUrl = `https://${host}/login/oauth/authorize?client_id=${opts.githubClient}${
			opts.scopes?.length ? `&scope=${opts.scopes.join(" ")}` : ""
		}&redirect_uri=${redirectURI}&state=${state}`;
		req.log.info({ redirectUrl, postLoginUrl: req.session[state] }, `Received request for ${opts.loginURI}, redirecting to Github OAuth flow`);
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

		// Show the oauth error if there is one
		if (error) {
			return next(`OAuth Error: ${error}
      URL: ${error_uri}
      ${error_description}`);
		}

		// Take save redirect url and delete it from session
		const redirectUrl = req.session[state] as string;
		delete req.session[state];

		req.log.info({ query: req.query }, `Received request to ${opts.callbackURI}`);

		// Check if state is available and matches a previous request
		if (!state || !redirectUrl) return next("Missing matching Auth state parameter");
		if (!code) return next("Missing OAuth Code");

		if (await booleanFlag(BooleanFlags.PROPAGATE_REQUEST_ID, true)) {
			req.log.info({ jiraHost: getJiraHostFromRedirectUrlNew(redirectUrl, req.log) }, "Jira Host attempting to auth with GitHub");
		} else {
			req.log.info({ jiraHost: getJiraHostFromRedirectUrl(redirectUrl) }, "Jira Host attempting to auth with GitHub");
		}

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
				return next(new Error("Missing Access Token from Github OAuth Flow."));
			}

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
		checkGithubAuth: (req: Request, res: Response, next: NextFunction) => {
			if (!req.session.githubToken) {
				res.locals.redirect = req.originalUrl;
				return login(req, res);
			}
			return next();
		}
	};
};
