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
import getJiraConnect from "../jira/connect";
import postJiraDisable from "../jira/disable";
import postJiraEnable from "../jira/enable";
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
import { metricError } from "../config/metric-names";
import { authenticateInstallCallback, authenticateJiraEvent, authenticateUninstallCallback, verifyJiraContextJwtTokenMiddleware, verifyJiraJwtTokenMiddleware } from "./verify-jira-jwt-middleware";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { isNodeProd, isNodeTest } from "../util/isNodeEnv";
import { registerHandlebarsPartials } from "../util/handlebars/partials";
import { registerHandlebarsHelpers } from "../util/handlebars/helpers";
import { Errors } from "../config/errors";

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

const saveSessionVariables = (req: Request, _: Response, next: NextFunction) => {
	req.log.info("Setting session variables 'jiraHost'");
	// set jirahost after token if no errors
	req.session.jiraHost = req.query.xdm_e as string;
	next();
};

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

	app.set("view engine", "hbs");
	app.set("views", path.join(rootPath, "views"));

	registerHandlebarsPartials(rootPath);

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
		deleteGitHubSubscription
	);

	app.get(
		"/jira/configuration",
		csrfProtection,
		verifyJiraJwtTokenMiddleware,
		saveSessionVariables,
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
			const jiraHost = req.session.jiraHost;
			if (jiraHost) {
				scope.setTag("jiraHost", jiraHost);
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

		const messages = {
			[Errors.MISSING_JIRA_HOST]: "Session information missing - please enable all cookies in your browser settings."
		};

		const errorStatusCode = errorCodes[err.message] || 500;
		const message = messages[err.message];
		const tags = [`status: ${errorStatusCode}`];

		statsd.increment(metricError.githubErrorRendered, tags);

		const newErrorPgFlagIsOn = await booleanFlag(BooleanFlags.NEW_GITHUB_ERROR_PAGE, true, req.session.jiraHost);
		const errorPageVersion = newErrorPgFlagIsOn ? "github-error.hbs" : "github-error-OLD.hbs";

		return res.status(errorStatusCode).render(errorPageVersion, {
			title: "GitHub + Jira integration",
			message,
			nonce: res.locals.nonce
		});
	});

	return app;
};
