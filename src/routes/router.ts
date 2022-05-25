import { Request, Response, Router } from "express";
import { ApiRouter } from "./api/api-router";
import { GithubRouter } from "./github/github-router";
import { JiraRouter } from "./jira/jira-router";
import { VersionGet } from "./version/version-get";
import { HealthcheckRouter } from "./healthcheck/healthcheck-router";
import * as Sentry from "@sentry/node";
import { json, urlencoded } from "body-parser";
import cookieParser from "cookie-parser";
import { LogMiddleware } from "middleware/frontend-log-middleware";
import { SessionGet } from "./session/session-get";
import { jirahostMiddleware } from "middleware/jirahost-middleware";
import { cookieSessionMiddleware } from "middleware/cookiesession-middleware";
import { ErrorRouter } from "./error-router";
import { MaintenanceRouter } from "./maintenance/maintenance-router";
import { PublicRouter } from "./public/public-router";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { createAppClient } from "utils/check-github-app-type";

export const RootRouter = Router();

// The request handler must be the first middleware on the app
RootRouter.use(Sentry.Handlers.requestHandler());

// Parse URL-encoded bodies for Jira configuration requests
RootRouter.use(urlencoded({ extended: false }));
RootRouter.use(json());
RootRouter.use(cookieParser());

// Add pertinent information to logger for all subsequent routes
RootRouter.use(LogMiddleware);

// Static Assets
RootRouter.use("/public", PublicRouter);

// Session redirect
RootRouter.get(["/session", "/session/*"], SessionGet);

RootRouter.use(cookieSessionMiddleware);

// Saves the jiraHost cookie to the secure session if available
RootRouter.use(jirahostMiddleware);

// These 2 need to be first (above maintenance mode) to make sure they're always accessible
RootRouter.use(HealthcheckRouter);
RootRouter.get("/version", VersionGet);

// Api needs to be before maintenance
RootRouter.use("/api", ApiRouter);

// Maintenance mode - needs to be before all other routes
RootRouter.use(MaintenanceRouter);

RootRouter.use("/github", GithubRouter);
RootRouter.use("/jira", JiraRouter);

// On base path, redirect to Github App Marketplace URL
RootRouter.get("/", async (req: Request, res: Response) => {
	const gitHubAppClient = await createAppClient(req.log, jiraHost);
	const { data: info } = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_REDIRECT, false) ?
		await gitHubAppClient.getApp() :
		await res.locals.client.apps.getAuthenticated();

	return res.redirect(info.external_url);
});

// For when nothing gets triggered in the above routes, or an error occurs
RootRouter.use(ErrorRouter);
