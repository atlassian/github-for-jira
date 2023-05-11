import { Router } from "express";
import { JiraWorkspacesGet } from "routes/jira/workspaces/jira-workspaces-get";
import {
	JiraWorkspacesRepositoriesFetchAll
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-fetch-all";
import {
	JiraWorkspacesRepositoriesCreate
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-create";

export const JiraWorkspacesRepositoriesRouter = Router();

JiraWorkspacesRepositoriesRouter.route("/search")
	.get(JiraWorkspacesGet);

JiraWorkspacesRepositoriesRouter.route("/fetch")
	.post(JiraWorkspacesRepositoriesFetchAll);

JiraWorkspacesRepositoriesRouter.route("/create")
	.post(JiraWorkspacesRepositoriesCreate);
