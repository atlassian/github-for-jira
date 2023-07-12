import { Router } from "express";
import { JiraSecurityWorkspacesContainersRouter } from "~/src/routes/jira/security/workspaces/containers/jira-security-workspaces-containers-router";

export const JiraSecurityWorkspacesRouter = Router();

JiraSecurityWorkspacesRouter.use(
	"/workspaces",
	JiraSecurityWorkspacesContainersRouter
);
