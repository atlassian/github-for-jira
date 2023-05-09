import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraRepositoriesPost } from "routes/jira/repositories/jira-repositories-post";

export const JiraRepositoriesRouter = Router();


JiraRepositoriesRouter.route("/fetch")
	.post(csrfMiddleware, JiraRepositoriesPost);
// .get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspaceContainersGet);
