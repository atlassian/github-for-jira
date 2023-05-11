import { Router } from "express";
import { JiraWorkspacesGet } from "routes/jira/workspaces/jira-workspaces-get";
import { jiraSymmetricJwtMiddleware } from "middleware/jira-symmetric-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectRouter } from "routes/jira/connect/jira-connect-router";
import { JiraWorkspacesRepositoriesRouter } from "routes/jira/workspaces/repositories/jira-repositories-router";

export const JiraWorkspacesRouter = Router();

JiraWorkspacesRouter.use(csrfMiddleware, jiraSymmetricJwtMiddleware);

JiraWorkspacesRouter.route("/search")
	.get(JiraWorkspacesGet);

JiraConnectRouter.use("/repositories", JiraWorkspacesRepositoriesRouter);
