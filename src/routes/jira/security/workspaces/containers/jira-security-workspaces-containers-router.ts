import { Router } from "express";
import {
	JiraSecurityWorkspacesContainersPost
} from "~/src/routes/jira/security/workspaces/containers/jira-security-workspaces-containers-post";
import { JiraSecurityWorkspacesContainersSearchGet } from "./jira-security-workspaces-containers-search-get";

export const JiraSecurityWorkspacesContainersRouter = Router();

JiraSecurityWorkspacesContainersRouter.route("/containers")
	.post(JiraSecurityWorkspacesContainersPost);

JiraSecurityWorkspacesContainersRouter.route("/containers/search")
	.get(JiraSecurityWorkspacesContainersSearchGet);
