import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraWorkspaceContainersGet } from  "./jira-workspace-containers-get";

export const JiraWorkspaceRouter = Router();


JiraWorkspaceRouter.route("/containers")
	.get(csrfMiddleware, JiraWorkspaceContainersGet);
// .get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspaceContainersGet);
