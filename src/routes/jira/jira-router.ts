import { Router } from "express";
import { JiraConfigurationRouter } from "./configuration/jira-configuration-router";
import { JiraSyncPost } from "./jira-sync-post";
import { JiraAtlassianConnectGet } from "./atlassian-connect/jira-atlassian-connect-get";
import { JiraEventsRouter } from "./events/jira-events-router";
import { JiraSelectProductRouter } from "./server/jira-select-product-router";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraServerUrlRouter } from "routes/jira/server/jira-server-url-router";
import { JiraAppCreationRouter } from "./server/jira-app-creation-router";
import { JiraGheServerRouter } from "routes/jira/server/jira-ghe-server-router";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraGet } from "routes/jira/jira-get";
import { JiraEditAppGet } from "routes/jira/server/jira-edit-app-get";
import { JiraDelete } from "routes/jira/jira-delete";

export const JiraRouter = Router();

// TODO: The params `installationId` needs to be replaced by `subscriptionId`
JiraRouter.delete("/subscription/:installationId", JiraContextJwtTokenMiddleware, JiraDelete);

// TODO: Need to cleanup the URLs and Routers

JiraRouter.get("/atlassian-connect.json", JiraAtlassianConnectGet);
JiraRouter.get("/edit-app/:id", csrfMiddleware, JiraJwtTokenMiddleware, JiraEditAppGet);

// TODO - add csrf middleware
JiraRouter.post("/sync", JiraContextJwtTokenMiddleware, JiraSyncPost);
JiraRouter.use("/events", JiraEventsRouter);
JiraRouter.use("/select-product", JiraSelectProductRouter);
JiraRouter.use("/server-url", JiraServerUrlRouter);
JiraRouter.use("/app-creation", JiraAppCreationRouter);

JiraRouter.use("/ghe-servers", csrfMiddleware, JiraJwtTokenMiddleware, JiraGheServerRouter);

JiraRouter.get("/", csrfMiddleware, JiraJwtTokenMiddleware, JiraGet);

/********************************************************************************************************************
 * TODO: remove this later, keeping this for now cause its out in `Prod`
 * *******************************************************************************************************************/
JiraRouter.use("/configuration", JiraConfigurationRouter);