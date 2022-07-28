import { Router } from "express";
import { JiraConfigurationRouter } from "./configuration/jira-configuration-router";
import { JiraSyncPost } from "./sync/jira-sync-post";
import { JiraAtlassianConnectGet } from "./atlassian-connect/jira-atlassian-connect-get";
import { JiraEventsRouter } from "./events/jira-events-router";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraAppCreationRouter } from "./server/jira-app-creation-router";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraGet } from "routes/jira/jira-get";
import { JiraEditAppGet } from "routes/jira/server/jira-edit-app-get";
import { JiraDelete } from "routes/jira/jira-delete";
import { JiraConnectRouter } from "routes/jira/connect/jira-connect-router";

export const JiraRouter = Router();

// TODO: The params `installationId` needs to be replaced by `subscriptionId`
JiraRouter.delete("/subscription/:installationId", JiraContextJwtTokenMiddleware, JiraDelete);

JiraRouter.use("/connect", JiraConnectRouter);

JiraRouter.get("/atlassian-connect.json", JiraAtlassianConnectGet);

// TODO: Need to cleanup the URLs and Routers
JiraRouter.get("/edit-app/:id", csrfMiddleware, JiraJwtTokenMiddleware, JiraEditAppGet);
// TODO - add csrf middleware
JiraRouter.post("/sync", JiraContextJwtTokenMiddleware, JiraSyncPost);
JiraRouter.use("/events", JiraEventsRouter);
JiraRouter.use("/app-creation", JiraAppCreationRouter);


JiraRouter.get("/", csrfMiddleware, JiraJwtTokenMiddleware, JiraGet);

/********************************************************************************************************************
 * TODO: remove this later, keeping this for now cause its out in `Prod`
 * *******************************************************************************************************************/
JiraRouter.use("/configuration", JiraConfigurationRouter);