import { Router } from "express";
import {
	JiraWorkspacesRepositoriesAssociate
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-associate";
import { JiraWorkspacesRepositoriesGet } from "routes/jira/workspaces/repositories/jira-workspaces-repositories-get";

export const JiraWorkspacesRepositoriesRouter = Router();

JiraWorkspacesRepositoriesRouter.route("/search")
	.get(JiraWorkspacesRepositoriesGet);

JiraWorkspacesRepositoriesRouter.route("/associate")
	.post(JiraWorkspacesRepositoriesAssociate);
