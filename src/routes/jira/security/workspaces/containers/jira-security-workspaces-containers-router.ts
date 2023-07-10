import { Router } from "express";
import {
	JiraSecurityWorkspacesContainersPost
} from "~/src/routes/jira/security/workspaces/containers/jira-security-workspaces-containers-post";

export const JiraSecurityWorkspacesContainersRouter = Router();

JiraSecurityWorkspacesContainersRouter.route("/search")
	.post(JiraSecurityWorkspacesContainersPost);
