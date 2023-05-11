import { Router } from "express";
import { JiraWorkspacesGet } from "routes/jira/workspaces/jira-workspaces-get";

export const JiraWorkspacesRepositoriesRouter = Router();

JiraWorkspacesRepositoriesRouter.route("/search")
	.get(JiraWorkspacesGet);

JiraWorkspacesRepositoriesRouter.route("/fetch")
	.post(JiraWorkspacesGet);

JiraWorkspacesRepositoriesRouter.route("/create")
	.post(JiraWorkspacesGet);
