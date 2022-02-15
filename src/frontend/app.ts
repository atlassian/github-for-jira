import bodyParser from "body-parser";
import express, { Express, NextFunction, Request, Response } from "express";
import path from "path";
import cookieSession from "cookie-session";
import csrf from "csurf";
import * as Sentry from "@sentry/node";
import GithubOAuth from "./github-oauth";
import getGitHubSetup from "./get-github-setup";
import postGitHubSetup from "./post-github-setup";
import getGitHubConfiguration from "./get-github-configuration";
import postGitHubConfiguration from "./post-github-configuration";
import getGitHubSubscriptions from "./get-github-subscriptions";
import deleteGitHubSubscription from "./delete-github-subscription";
import getJiraConfiguration from "./get-jira-configuration";
import deleteJiraConfiguration from "./delete-jira-configuration";
import getGithubClientMiddleware from "./github-client-middleware";
import getJiraConnect, { postInstallUrl } from "../jira/connect";
import postJiraInstall from "../jira/install";
import postJiraUninstall from "../jira/uninstall";
import extractInstallationFromJiraCallback from "../jira/extract-installation-from-jira-callback";
import retrySync from "./retry-sync";
import getMaintenance from "./get-maintenance";
import api from "../api";
import healthcheck from "./healthcheck";
import version from "./version";
import logMiddleware from "../middleware/frontend-log-middleware";
import { App } from "@octokit/app";
import statsd from "../config/statsd";
import envVars from "../config/env";
import { metricError } from "../config/metric-names";
import { authenticateInstallCallback, authenticateUninstallCallback, verifyJiraContextJwtTokenMiddleware, verifyJiraJwtTokenMiddleware } from "./verify-jira-jwt-middleware";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { isNodeProd, isNodeTest } from "../util/isNodeEnv";
import { registerHandlebarsPartials } from "../util/handlebars/partials";
import { registerHandlebarsHelpers } from "../util/handlebars/helpers";
import { Errors } from "../config/errors";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";

// Adding session information to request
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface Request {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			body?: Record<string, any>;
			session: {
				jiraHost?: string;
				githubToken?: string;
			};
		}
	}
}

const throwError = (msg: string) => {
	throw new Error(msg);
};

const oauth = GithubOAuth({
	githubClient: process.env.GITHUB_CLIENT_ID || throwError("Missing GITHUB_CLIENT_ID"),
	githubSecret: process.env.GITHUB_CLIENT_SECRET || throwError("Missing GITHUB_CLIENT_SECRET"),
	baseURL: process.env.APP_URL || throwError("Missing APP_URL"),
	loginURI: "/github/login",
	callbackURI: "/github/callback"
});

// setup route middlewares
const csrfProtection = csrf(
	isNodeTest()
		? {
			ignoreMethods: ["GET", "HEAD", "OPTIONS", "POST", "PUT"]
		}
		: undefined
);

export default (octokitApp: App): Express => {
	const githubClientMiddleware = getGithubClientMiddleware(octokitApp);

	const app = express();
	const rootPath = path.resolve(__dirname, "..", "..");

	// The request handler must be the first middleware on the app
	app.use(Sentry.Handlers.requestHandler());

	// Parse URL-encoded bodies for Jira configuration requests
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());
	app.use(cookieParser());

	// We run behind ngrok.io so we need to trust the proxy always
	// TODO: look into the security of this.  Maybe should only be done for local dev?
	app.set("trust proxy", true);

	app.use(
		cookieSession({
			keys: [process.env.GITHUB_CLIENT_SECRET || throwError("Missing GITHUB_CLIENT_SECRET")],
			maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
			signed: true,
			sameSite: "none",
			secure: true,
			httpOnly: false
		})
	);

	app.use(logMiddleware);

	app.set("view engine", "hbs");
	const viewPath = path.resolve(rootPath, "views")
	app.set("views", viewPath);

	registerHandlebarsPartials(path.resolve(viewPath, "partials"));
	registerHandlebarsHelpers();

	app.use("/public", express.static(path.join(rootPath, "static")));
	app.use(
		"/public/css-reset",
		express.static(
			path.join(rootPath, "node_modules/@atlaskit/css-reset/dist")
		)
	);
	app.use(
		"/public/primer",
		express.static(path.join(rootPath, "node_modules/primer/build"))
	);
	app.use(
		"/public/atlassian-ui-kit",
		express.static(
			path.join(rootPath, "node_modules/@atlaskit/reduced-ui-pack/dist")
		)
	);

	app.use(
		"/public/aui",
		express.static(
			path.join(rootPath, "node_modules/@atlassian/aui/dist/aui")
		)
	);

	app.get(["/session", "/session/*"], (req: Request, res: Response, next: NextFunction) => {
		if (!req.params[0]) {
			return next(new Error("Missing redirect url for session.  Needs to be in format `/session/:redirectUrl`"));
		}

		return res.render("session.hbs", {
			title: "Logging you into GitHub",
			APP_URL: process.env.APP_URL,
			redirectUrl: new URL(req.params[0], process.env.APP_URL).href,
			nonce: res.locals.nonce
		});
	});

	// Saves the jiraHost cookie to the secure session if available
	app.use((req: Request, res: Response, next: NextFunction) => {
		if (req.cookies.jiraHost) {
			// Save jirahost to secure session
			req.session.jiraHost = req.cookies.jiraHost;
			// delete jirahost from cookies.
			res.clearCookie("jiraHost");
		}

		if (req.path == postInstallUrl && req.method == "GET") {
			// Only save xdm_e query when on the GET post install url (iframe url)
			res.locals.jiraHost = req.query.xdm_e as string;
		} else if ((req.path == postInstallUrl && req.method != "GET") || req.path == "/jira/sync") {
			// Only save the jiraHost from the body for specific routes that use it
			res.locals.jiraHost = req.body?.jiraHost;
		} else {
			// Save jiraHost from session for any other URLs
			res.locals.jiraHost = req.session.jiraHost;
		}

		next();
	});

	app.use(githubClientMiddleware);

	app.use("/", healthcheck);

	app.use("/api", api);

	// Add oauth routes
	app.use("/", oauth.router);

	// Atlassian Marketplace Connect
	app.get("/jira/atlassian-connect.json", getJiraConnect);

	// Maintenance mode view
	app.use(async (req: Request, res: Response, next: NextFunction) => {
		if (await booleanFlag(BooleanFlags.MAINTENANCE_MODE, false, res.locals.jiraHost)) {
			return getMaintenance(req, res);
		}
		next();
	});

	app.get("/version", version);

	app.get("/maintenance", csrfProtection, getMaintenance);

	app.get(
		"/github/setup",
		csrfProtection,
		oauth.checkGithubAuth,
		getGitHubSetup
	);

	app.post(
		"/github/setup",
		csrfProtection,
		postGitHubSetup
	);

	app.get(
		"/github/configuration",
		csrfProtection,
		oauth.checkGithubAuth,
		getGitHubConfiguration
	);

	app.post(
		"/github/configuration",
		csrfProtection,
		oauth.checkGithubAuth,
		postGitHubConfiguration
	);

	app.get(
		"/github/subscriptions/:installationId",
		csrfProtection,
		getGitHubSubscriptions
	);

	app.post(
		"/github/subscription",
		csrfProtection,
		oauth.checkGithubAuth,
		deleteGitHubSubscription
	);

	app.get(
		"/jira/configuration",
		csrfProtection,
		verifyJiraJwtTokenMiddleware,
		getJiraConfiguration
	);

	app.delete(
		"/jira/configuration",
		verifyJiraContextJwtTokenMiddleware,
		deleteJiraConfiguration
	);

	app.post("/jira/sync", verifyJiraContextJwtTokenMiddleware, retrySync);
	// Set up event handlers

	// TODO: remove enabled and disabled events once the descriptor is updated in marketplace
	app.post("/jira/events/disabled", (_: Request, res: Response) => {
		return res.sendStatus(204);
	});
	app.post("/jira/events/enabled", (_: Request, res: Response) => {
		return res.sendStatus(204);
	});

	app.post("/jira/events/installed", authenticateInstallCallback, postJiraInstall);
	app.post("/jira/events/uninstalled", authenticateUninstallCallback, extractInstallationFromJiraCallback, postJiraUninstall);
	app.get("/", async (_: Request, res: Response) => {
		const { data: info } = await res.locals.client.apps.getAuthenticated({});
		return res.redirect(info.external_url);
	});

	// Add Sentry Context
	app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
		Sentry.withScope((scope: Sentry.Scope): void => {
			const jiraHost = res.locals.jiraHost;
			if (jiraHost) {
				scope.setTag("jiraHost", jiraHost);
			}

			if (req.body) {
				Sentry.setExtra("Body", req.body);
			}

			next(err);
		});
	});

	// Error endpoints to test out different error pages
	app.get(["/error", "/error/:message", "/error/:message/:name"], (req: Request, res: Response, next: NextFunction) => {
		res.locals.showError = true;
		const error = new Error(req.params.message);
		if(req.params.name) {
			error.name = req.params.name
		}
		next(error);
	});

	// The error handler must come after controllers and before other error middleware
	app.use(Sentry.Handlers.errorHandler());

	// Error catcher - Batter up!
	app.use(async (err: Error, req: Request, res: Response, next: NextFunction) => {
		const errorReference = uuidv4();

		req.log.error({ payload: req.body, errorReference, err, req, res }, "Error in frontend app.")

		if (!isNodeProd() && !res.locals.showError) {
			return next(err);
		}

		// Check for IP Allowlist error from Github and set the message explicitly
		// to be shown to the user in the error page
		if (err.name == "HttpError" && err.message?.includes("organization has an IP allow list enabled")) {
			err.message = Errors.IP_ALLOWLIST_MISCONFIGURED;
		}

		// TODO: move this somewhere else, enum?
		const errorCodes = {
			Unauthorized: 401,
			Forbidden: 403,
			"Not Found": 404
		};

		const messages = {
			[Errors.MISSING_JIRA_HOST]: "Session information missing - please enable all cookies in your browser settings.",
			[Errors.IP_ALLOWLIST_MISCONFIGURED]: `The GitHub org you are trying to connect is currently blocking our requests. To configure the GitHub IP Allow List correctly, <a href="${envVars.GITHUB_REPO_URL}/blob/main/docs/ip-allowlist.md">please follow these instructions</a>.`
		};

		const errorStatusCode = errorCodes[err.message] || 500;
		const message = messages[err.message];
		const tags = [`status: ${errorStatusCode}`];

		statsd.increment(metricError.githubErrorRendered, tags);

		return res.status(errorStatusCode).render("error.hbs", {
			title: "GitHub + Jira integration",
			errorReference,
			message,
			nonce: res.locals.nonce,
			githubRepoUrl: envVars.GITHUB_REPO_URL
		});
	});

	return app;
};
