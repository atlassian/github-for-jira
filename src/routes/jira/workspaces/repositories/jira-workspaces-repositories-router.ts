import { Router } from "express";
import { JiraWorkspacesGet } from "routes/jira/workspaces/jira-workspaces-get";
import {
	JiraWorkspacesRepositoriesFetchAll
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-fetch-all";
import {
	JiraWorkspacesRepositoriesCreate
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-create";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { jiraSymmetricJwtMiddleware } from "middleware/jira-symmetric-jwt-middleware";

export const JiraWorkspacesRepositoriesRouter = Router();

JiraWorkspacesRepositoriesRouter.route("/search")
	.get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspacesGet);

JiraWorkspacesRepositoriesRouter.route("/fetch")
	.post(jiraSymmetricJwtMiddleware, JiraWorkspacesRepositoriesFetchAll);

JiraWorkspacesRepositoriesRouter.route("/create")
	.post(jiraSymmetricJwtMiddleware, JiraWorkspacesRepositoriesCreate);
