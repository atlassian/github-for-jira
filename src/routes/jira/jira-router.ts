import { Router } from "express";
import { JiraConfigurationRouter } from "./configuration/jira-configuration-router";
import { JiraSyncPost } from "./jira-sync-post";
import { JiraAtlassianConnectGet } from "./jira-atlassian-connect-get";
import { JiraEventsRouter } from "./events/jira-events-router";
import { JiraSelectProductRouter } from "./server/jira-select-product-router";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraServerUrlRouter } from "routes/jira/server/jira-server-url-router";
import { JiraAppCreationRouter } from "./server/jira-app-creation-router";
import { JiraGheServerRouter } from "routes/jira/server/jira-ghe-server-router";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraEditAppGet } from "routes/jira/server/jira-edit-app-get";

export const JiraRouter = Router();

// TODO: Need to cleanup the URLs and Routers

JiraRouter.get("/atlassian-connect.json", JiraAtlassianConnectGet);
JiraRouter.get("/edit-app/:id", csrfMiddleware, JiraJwtTokenMiddleware, JiraEditAppGet);

JiraRouter.use("/configuration", JiraConfigurationRouter);
// TODO - add csrf middleware
JiraRouter.post("/sync", JiraContextJwtTokenMiddleware, JiraSyncPost);
JiraRouter.use("/events", JiraEventsRouter);
JiraRouter.use("/select-product", JiraSelectProductRouter);
JiraRouter.use("/server-url", JiraServerUrlRouter);
JiraRouter.use("/app-creation", JiraAppCreationRouter);

JiraRouter.use("/ghe-servers", csrfMiddleware, JiraJwtTokenMiddleware, JiraGheServerRouter);
