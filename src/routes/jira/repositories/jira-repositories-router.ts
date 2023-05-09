import { Router } from "express";
import { JiraRepositoriesPost } from "routes/jira/repositories/jira-repositories-post";

export const JiraRepositoriesRouter = Router();


JiraRepositoriesRouter.route("/fetch")
	.post(JiraRepositoriesPost);
// .get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspaceContainersGet);
