import { Router } from "express";
import { JiraSecurityWorkspacesContainersRouter } from "~/src/routes/jira/security/workspaces/containers/jira-security-workspaces-containers-router";
import { JiraSecurityWorkspacesPost } from "~/src/routes/jira/security/workspaces/jira-security-workspaces-post";

export const JiraSecurityWorkspacesRouter = Router();

JiraSecurityWorkspacesRouter.use(
	"/workspaces",
	JiraSecurityWorkspacesContainersRouter
);

JiraSecurityWorkspacesRouter.route("/workspaces").post(
	JiraSecurityWorkspacesPost
);
