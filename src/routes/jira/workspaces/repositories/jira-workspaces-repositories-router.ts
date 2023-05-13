import { Router } from "express";

import {
	JiraWorkspacesRepositoriesAssociate
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-associate";
import {
	JiraWorkspacesRepositoriesCreate
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-create";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { jiraSymmetricJwtMiddleware } from "middleware/jira-symmetric-jwt-middleware";
import { JiraWorkspacesRepositoriesGet } from "routes/jira/workspaces/repositories/jira-workspaces-repositories-get";

export const JiraWorkspacesRepositoriesRouter = Router();

JiraWorkspacesRepositoriesRouter.route("/search")
	.get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraWorkspacesRepositoriesGet);

JiraWorkspacesRepositoriesRouter.route("/associate")
	.post(jiraSymmetricJwtMiddleware, JiraWorkspacesRepositoriesAssociate);

JiraWorkspacesRepositoriesRouter.route("/create")
	.post(jiraSymmetricJwtMiddleware, JiraWorkspacesRepositoriesCreate);
