import { Router } from "express";
import { JiraWorkspacesGet } from "routes/jira/workspaces/jira-workspaces-get";
import {
	JiraWorkspacesRepositoriesAssociate
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-associate";
import {
	JiraWorkspacesRepositoriesCreate
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-create";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { jiraSymmetricJwtMiddleware } from "middleware/jira-symmetric-jwt-middleware";

export const JiraWorkspacesRepositoriesRouter = Router();

JiraWorkspacesRepositoriesRouter.route("/search")
	.get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspacesGet);

JiraWorkspacesRepositoriesRouter.route("/fetch")
	.post(jiraSymmetricJwtMiddleware, JiraWorkspacesRepositoriesAssociate);

JiraWorkspacesRepositoriesRouter.route("/create")
	.post(jiraSymmetricJwtMiddleware, JiraWorkspacesRepositoriesCreate);
