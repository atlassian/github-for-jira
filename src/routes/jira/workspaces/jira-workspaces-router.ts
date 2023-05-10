import { Router } from "express";
import { JiraWorkspacesGet } from "routes/jira/workspaces/jira-workspaces-get";
import { jiraSymmetricJwtMiddleware } from "middleware/jira-symmetric-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";

export const JiraWorkspacesRouter = Router();

JiraWorkspacesRouter.route("/search")
	.get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspacesGet);
