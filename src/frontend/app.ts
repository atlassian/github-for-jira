import bodyParser from "body-parser";
import express, { Express, NextFunction, Request, Response } from "express";
import path from "path";
import cookieSession from "cookie-session";
import csrf from "csurf";
import * as Sentry from "@sentry/node";
import hbs from "hbs";
import GithubOAuth from "./github-oauth";
import getGitHubSetup from "./get-github-setup";
import postGitHubSetup from "./post-github-setup";
import getGitHubConfiguration from "./get-github-configuration";
import postGitHubConfiguration from "./post-github-configuration";
import listGitHubInstallations from "./list-github-installations";
import getGitHubSubscriptions from "./get-github-subscriptions";
import deleteGitHubSubscription from "./delete-github-subscription";
import getJiraConfiguration from "./get-jira-configuration";
import deleteJiraConfiguration from "./delete-jira-configuration";
import getGithubClientMiddleware from "./github-client-middleware";
import getJiraConnect from "../jira/connect";
import postJiraDisable from "../jira/disable";
import postJiraEnable from "../jira/enable";
import postJiraInstall from "../jira/install";
import postJiraUninstall from "../jira/uninstall";
import { authenticateInstallCallback, authenticateJiraEvent, authenticateUninstallCallback } from "../jira/authenticate";
import extractInstallationFromJiraCallback from "../jira/extract-installation-from-jira-callback";
import retrySync from "./retry-sync";
import getMaintenance from "./get-maintenance";
import api from "../api";
import healthcheck from "./healthcheck";
import logMiddleware from "../middleware/frontend-log-middleware";
import { App } from "@octokit/app";
import statsd from "../config/statsd";
import { metricError } from "../config/metric-names";
import { verifyJiraContextJwtTokenMiddleware, verifyJiraJwtTokenMiddleware } from "./verify-jira-jwt-middleware";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { isNodeProd, isNodeTest } from "../util/isNodeEnv";

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
				jwt?: string;
				[key: string]: unknown;
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

	// We run behind ngrok.io so we need to trust the proxy always
	// TODO: look into the security of this.  Maybe should only be done for local dev?
	app.set("trust proxy", true);

	app.use(
		cookieSession({
			keys: [process.env.GITHUB_CLIENT_SECRET || throwError("Missing GITHUB_CLIENT_SECRET")],
			maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
			signed: true,
			sameSite: "none",
			secure: true
		})
	);

	app.use(logMiddleware);

	// TODO: move all view/static/public/handlebars helper things in it's own folder
	app.set("view engine", "hbs");
	app.set("views", path.join(rootPath, "views"));

	// Handlebars helpers
	hbs.registerHelper("toLowerCase", (str) => str.toLowerCase());

	hbs.registerHelper("replaceSpaceWithHyphen", (str) => str.replace(/ /g, "-"));

	hbs.registerHelper(
		"ifAllReposSynced",
		(numberOfSyncedRepos, totalNumberOfRepos) =>
			numberOfSyncedRepos === totalNumberOfRepos
				? totalNumberOfRepos
				: `${numberOfSyncedRepos} / ${totalNumberOfRepos}`
	);

	hbs.registerHelper("repoAccessType", (repository_selection) =>
		repository_selection === "all" ? "All repos" : "Only select repos"
	);

	hbs.registerHelper("isNotConnected", (syncStatus) => syncStatus == null);

	hbs.registerHelper(
		"inProgressSync",
		(syncStatus) => syncStatus === "IN PROGRESS"
	);

	hbs.registerHelper("failedSync", (syncStatus) => syncStatus === "FAILED");

	hbs.registerHelper("failedConnectionErrorMsg", (deleted) =>
		deleted
			? "The GitHub for Jira app was uninstalled from this org."
			: "There was an error getting information for this installation."
	);

	hbs.registerHelper("connectedStatus", (syncStatus) =>
		syncStatus === "COMPLETE" ? "Connected" : "Connect"
	);

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

	// Check to see if jira host has been passed to any routes and save it to session
	app.use((req: Request, _: Response, next: NextFunction): void => {
		req.session.jwt = (req.query.jwt as string) || req.session.jwt;
		req.session.jiraHost = (req.query.xdm_e as string) || req.session.jiraHost;
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
	app.use(async (req, res, next) => {
		if (await booleanFlag(BooleanFlags.MAINTENANCE_MODE, false, req.session.jiraHost)) {
			return getMaintenance(req, res);
		}
		next();
	});

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
		postGitHubConfiguration
	);

	app.get(
		"/github/installations",
		csrfProtection,
		oauth.checkGithubAuth,
		listGitHubInstallations
	);

	app.get(
		"/github/subscriptions/:installationId",
		csrfProtection,
		getGitHubSubscriptions
	);

	app.post(
		"/github/subscription",
		csrfProtection,
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
	app.post("/jira/events/disabled", extractInstallationFromJiraCallback, authenticateJiraEvent, postJiraDisable);
	app.post("/jira/events/enabled", extractInstallationFromJiraCallback, authenticateJiraEvent, postJiraEnable);
	app.post("/jira/events/installed", authenticateInstallCallback, postJiraInstall);
	app.post("/jira/events/uninstalled", extractInstallationFromJiraCallback, authenticateUninstallCallback, postJiraUninstall);

	app.get("/", async (_: Request, res: Response) => {
		const { data: info } = await res.locals.client.apps.getAuthenticated({});
		return res.redirect(info.external_url);
	});

	// Add Sentry Context
	app.use((err: Error, req: Request, _: Response, next: NextFunction) => {
		Sentry.withScope((scope: Sentry.Scope): void => {
			if (req.session.jiraHost) {
				scope.setTag("jiraHost", req.session.jiraHost);
			}

			if (req.body) {
				Sentry.setExtra("Body", req.body);
			}

			next(err);
		});
	});
	// The error handler must come after controllers and before other error middleware
	app.use(Sentry.Handlers.errorHandler());

	// Error catcher - Batter up!
	app.use(async (err: Error, req: Request, res: Response, next: NextFunction) => {
		req.log.error({ err, req, res }, "Error in frontend app.");

		if (!isNodeProd()) {
			return next(err);
		}

		// TODO: move this somewhere else, enum?
		const errorCodes = {
			Unauthorized: 401,
			Forbidden: 403,
			"Not Found": 404
		};

		const errorStatusCode = errorCodes[err.message] || 500;

		const tags = [`status: ${errorStatusCode}`];

		statsd.increment(metricError.githubErrorRendered, tags);

		const newErrorPgFlagIsOn = await booleanFlag(BooleanFlags.NEW_GITHUB_ERROR_PAGE, false);
		const errorPageVersion = newErrorPgFlagIsOn ? "github-error.hbs" : "github-error-OLD.hbs"

		return res.status(errorStatusCode).render(errorPageVersion, {
			title: "GitHub + Jira integration",
			nonce: res.locals.nonce
		});
	});

	return app;
};
