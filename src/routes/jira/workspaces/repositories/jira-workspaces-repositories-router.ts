import { Router } from "express";
import { JiraWorkspacesRepositoriesGet } from "routes/jira/workspaces/jira-workspaces-get";
import {
	JiraWorkspacesRepositoriesAssociate
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-associate";
import {
	JiraWorkspacesRepositoriesCreate
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-create";

export const JiraWorkspacesRepositoriesRouter = Router();

JiraWorkspacesRepositoriesRouter.route("/search")
	.get(JiraWorkspacesRepositoriesGet);

JiraWorkspacesRepositoriesRouter.route("/associate")
	.post(JiraWorkspacesRepositoriesAssociate);

JiraWorkspacesRepositoriesRouter.route("/create")
	.post(JiraWorkspacesRepositoriesCreate);
