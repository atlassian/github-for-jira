import { Router } from "express";
import {
	JiraSecurityWorkspacesRepositoriesGet
} from "routes/jira/security/workspaces/repositories/jira-security-workspaces-repositories-get";
import {
	JiraSecurityWorkspacesRepositoriesPost
} from "routes/jira/security/workspaces/repositories/jira-security-workspaces-repositories-post";

export const JiraSecurityWorkspacesRepositoriesRouter = Router();

JiraSecurityWorkspacesRepositoriesRouter.route("/search")
	.get(JiraSecurityWorkspacesRepositoriesGet)
	.post(JiraSecurityWorkspacesRepositoriesPost);
