import { Router } from "express";
import { JiraWorkspaceGet } from "routes/jira/workspace/jira-workspace-get";
// import { csrfMiddleware } from "middleware/csrf-middleware";
// import { jiraSymmetricJwtMiddleware } from "middleware/jira-symmetric-jwt-middleware";

export const JiraWorkspaceRouter = Router();

JiraWorkspaceRouter.route("/")
	.get(JiraWorkspaceGet);
	// .get(csrfMiddleware, JiraWorkspaceGet);
// .get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspaceGet);
