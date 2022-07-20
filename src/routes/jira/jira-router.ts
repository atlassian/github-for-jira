import { Router } from "express";
import { JiraSyncPost } from "./jira-sync-post";
import { JiraAtlassianConnectGet } from "./jira-atlassian-connect-get";
import { JiraEventsRouter } from "./events/jira-events-router";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraGet } from "routes/jira/jira-get";
import { JiraDelete } from "routes/jira/jira-delete";
import { JiraConnectRouter } from "routes/jira/jira-connect-router";
import { JiraConfigurationRouter } from "routes/jira/configuration/jira-configuration-router";

export const JiraRouter = Router();

// TODO: remove this later, keeping this for now as it is out in Prod
JiraRouter.use("/configuration", JiraConfigurationRouter);


JiraRouter.get("/", csrfMiddleware, JiraJwtTokenMiddleware, JiraGet);

JiraRouter.delete("/subscription/:id", JiraContextJwtTokenMiddleware, JiraDelete);

JiraRouter.get("/atlassian-connect.json", JiraAtlassianConnectGet);

JiraRouter.use("/connect", JiraConnectRouter);

JiraRouter.post("/sync", JiraContextJwtTokenMiddleware, JiraSyncPost);

JiraRouter.use("/events", JiraEventsRouter);