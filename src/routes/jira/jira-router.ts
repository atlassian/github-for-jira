import { Router } from "express";
import { JiraConfigurationRouter } from "./configuration/jira-configuration-router";
import { JiraSyncPost } from "./sync/jira-sync-post";
import { JiraAtlassianConnectGet } from "./atlassian-connect/jira-atlassian-connect-get";
import { JiraEventsRouter } from "./events/jira-events-router";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraGet } from "routes/jira/jira-get";
import { JiraDelete } from "routes/jira/jira-delete";
import { JiraConnectRouter } from "routes/jira/connect/jira-connect-router";
import { body } from "express-validator";
import { returnOnValidationError } from "routes/api/api-utils";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jira-symmetric-jwt-middleware";
import { JiraGetConnectionsBackfillStatus } from "~/src/routes/jira/jira-get-connections-backfill-status";
import { JiraConnectedReposGet } from "routes/jira/jira-connected-repos-get";
import { jiraAdminPermissionsMiddleware } from "middleware/jira-admin-permission-middleware";
import { JiraWorkspacesRouter } from "routes/jira/workspaces/jira-workspaces-router";
import { JiraSecurityWorkspacesRouter } from "routes/jira/security/workspaces/jira-security-workspaces-router";

export const JiraRouter = Router();

// TODO: The params `installationId` needs to be replaced by `subscriptionId`
JiraRouter.delete("/subscription/:installationId", jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraDelete);

JiraRouter.get("/atlassian-connect.json", JiraAtlassianConnectGet);

JiraRouter.use("/connect", JiraConnectRouter);

JiraRouter.post("/sync",
	body("commitsFromDate").optional().isISO8601(),
	returnOnValidationError,
	jiraSymmetricJwtMiddleware,
	JiraSyncPost);

JiraRouter.use("/events", JiraEventsRouter);

JiraRouter.use("/workspaces", jiraSymmetricJwtMiddleware, JiraWorkspacesRouter);

JiraRouter.use("/security", jiraSymmetricJwtMiddleware, JiraSecurityWorkspacesRouter);

JiraRouter.get("/", csrfMiddleware, jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraGet);

JiraRouter.get("/subscriptions/backfill-status", jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraGetConnectionsBackfillStatus);
JiraRouter.get("/subscription/:subscriptionId/repos", csrfMiddleware, jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraConnectedReposGet);

/********************************************************************************************************************
 * TODO: remove this later, keeping this for now cause its out in `Prod`
 * *******************************************************************************************************************/
JiraRouter.use("/configuration", JiraConfigurationRouter);
