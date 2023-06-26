import { Router } from "express";
import { JiraSecurityWorkspacesPost } from "routes/jira/security/workspaces/jira-security-workspaces-post";
import {
	JiraSecurityWorkspacesRepositoriesRouter
} from "routes/jira/security/workspaces/repositories/jira-security-workspaces-repositories-router";


export const JiraSecurityWorkspacesRouter = Router();

JiraSecurityWorkspacesRouter.route("/search")
	.post(JiraSecurityWorkspacesPost);

JiraSecurityWorkspacesRouter.use("/repositories", JiraSecurityWorkspacesRepositoriesRouter);
