import { Request, Response, Router } from "express";
import { JiraConfigurationRouter } from "./configuration/jira-configuration-router";
import { JiraSyncPost } from "./jira-sync-post";
import { JiraAtlassianConnectGet } from "./jira-atlassian-connect-get";
import { JiraEventsRouter } from "./events/jira-events-router";
import { JiraSelectVersionRouter } from "./events/jira-select-version-router";
import { JiraContextJwtTokenMiddleware } from "middleware/jira-jwt-middleware";

export const JiraRouter = Router();

JiraRouter.get("/atlassian-connect.json", JiraAtlassianConnectGet);
JiraRouter.use("/configuration", JiraConfigurationRouter);
JiraRouter.post("/sync", JiraContextJwtTokenMiddleware, JiraSyncPost);
JiraRouter.use("/events", JiraEventsRouter);
JiraRouter.use("/select-version", JiraSelectVersionRouter);

// TODO: remove this before merging this branch
JiraRouter.get("/selectServer",  async (_: Request, res: Response): Promise<void> => {
	res.render("jira-select-github-cloud-app.hbs", {
		id: 1,
		serverUrl: 'https://github.internal.company.com',
		csrfToken: 2,
		nonce: res.locals.nonce,
		failedConnections: [],
		servers: [{ url: "ghe-app-for-jira" }, { url: "inter-team-app" }, { url: "carlos-app" }]
	});
});
