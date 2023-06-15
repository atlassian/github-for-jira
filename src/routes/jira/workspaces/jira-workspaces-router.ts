import { Router } from "express";
import { JiraWorkspacesGet } from "routes/jira/workspaces/jira-workspaces-get";
import {
	JiraWorkspacesRepositoriesRouter
} from "routes/jira/workspaces/repositories/jira-workspaces-repositories-router";

export const JiraWorkspacesRouter = Router();

JiraWorkspacesRouter.route("/search")
	.get(JiraWorkspacesGet);

JiraWorkspacesRouter.use("/repositories", JiraWorkspacesRepositoriesRouter);
