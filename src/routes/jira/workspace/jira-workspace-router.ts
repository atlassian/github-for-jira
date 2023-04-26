import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraWorkspaceContainersPost } from "routes/jira/workspace/containers/jira-workspace-containers-post";

export const JiraWorkspaceRouter = Router();


JiraWorkspaceRouter.route("/containers")
	.post(csrfMiddleware, JiraWorkspaceContainersPost);
// .get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspaceContainersGet);
