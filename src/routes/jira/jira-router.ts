import { Router } from "express";
import { JiraConfigurationRouter } from "./configuration/jira-configuration-router";
import { JiraSyncPost } from "./sync/jira-sync-post";
import { JiraAtlassianConnectGet } from "./atlassian-connect/jira-atlassian-connect-get";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraGet } from "routes/jira/jira-get";
import { JiraDelete } from "routes/jira/jira-delete";
import { JiraConnectRouter } from "routes/jira/connect/jira-connect-router";
import { body } from "express-validator";
import { returnOnValidationError } from "routes/api/api-utils";
import { JiraEventsRouter } from "routes/jira/events/jira-events-router";

export const JiraRouter = Router();

// TODO: The params `installationId` needs to be replaced by `subscriptionId`
JiraRouter.delete("/subscription/:installationId", JiraContextJwtTokenMiddleware, JiraDelete);

JiraRouter.get("/atlassian-connect.json", JiraAtlassianConnectGet);

JiraRouter.use("/connect", JiraConnectRouter);

JiraRouter.post("/sync",
	body("commitsFromDate").optional().isISO8601(),
	returnOnValidationError,
	JiraContextJwtTokenMiddleware,
	JiraSyncPost);

JiraRouter.use("/events", JiraEventsRouter);

JiraRouter.get("/", csrfMiddleware, JiraJwtTokenMiddleware, JiraGet);

/********************************************************************************************************************
 * TODO: remove this later, keeping this for now cause its out in `Prod`
 * *******************************************************************************************************************/
JiraRouter.use("/configuration", JiraConfigurationRouter);
