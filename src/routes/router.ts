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
import { createAppClient } from "~/src/util/get-github-client-config";
import { GithubManifestGet } from "routes/github/manifest/github-manifest-get";
import { GithubCreateBranchOptionsGet } from "~/src/routes/github/create-branch/github-create-branch-options-get";

export const RootRouter = Router();

// The request handler must be the first middleware on the app
RootRouter.use(Sentry.Handlers.requestHandler());

// Parse URL-encoded bodies for Jira configuration requests
RootRouter.use(urlencoded({ extended: false }));
RootRouter.use(json({
	limit: "30mb", //set limit according to github doc https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#webhook-payload-object-common-properties
	verify: (req: Request, _: Response, buf) => {
		req.rawBody = buf.toString();
	}
}));

RootRouter.use(cookieParser());

// Add pertinent information to logger for all subsequent routes
RootRouter.use(LogMiddleware);

// Static Assets
RootRouter.use("/public", PublicRouter);

// These 2 need to be first (above maintenance mode) to make sure they're always accessible
RootRouter.use(HealthcheckRouter);
RootRouter.get("/version", VersionGet);

// Api needs to be before maintenance
// Api needs to be before cookieSessionMiddleware, jirahostMiddleware, etc
// as those are for apps logic, api SHOULD NOT rely on any cookie/session/jiraHost header etc.
RootRouter.use("/api", ApiRouter);

// Maintenance mode - needs to be before all other routes
RootRouter.use(MaintenanceRouter);

// Session redirect
RootRouter.get(["/session", "/session/*"], SessionGet);

RootRouter.use(cookieSessionMiddleware);

// Saves the jiraHost cookie to the secure session if available
RootRouter.use(jirahostMiddleware);

// App Manifest flow route
RootRouter.get("/github-manifest", GithubManifestGet);

RootRouter.get("/create-branch-options", GithubCreateBranchOptionsGet);

RootRouter.use("/github", GithubRouter);
RootRouter.use("/jira", JiraRouter);

// On base path, redirect to Github App Marketplace URL
RootRouter.get("/", async (req: Request, res: Response) => {
	const { jiraHost, gitHubAppId } = res.locals;
	const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppId, undefined);
	const { data: info } = await gitHubAppClient.getApp();

	return res.redirect(info.external_url);
});

// For when nothing gets triggered in the above routes, or an error occurs
RootRouter.use(ErrorRouter);
