import { Router } from "express";
import { JiraWorkspacesGet } from "routes/jira/workspaces/jira-workspaces-get";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { jiraSymmetricJwtMiddleware } from "middleware/jira-symmetric-jwt-middleware";

export const JiraWorkspacesRouter = Router();

JiraWorkspacesRouter.route("/search")
	.get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspacesGet);
