import { Router } from "express";
import { JiraWorkspaceGet } from "routes/jira/workspaces/jira-workspace-get";
import { csrfMiddleware } from "middleware/csrf-middleware";
// import { jiraSymmetricJwtMiddleware } from "middleware/jira-symmetric-jwt-middleware";

export const JiraWorkspaceRouter = Router();

JiraWorkspaceRouter.route("/search")
	.get(csrfMiddleware, JiraWorkspaceGet);
// .get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspaceGet);
