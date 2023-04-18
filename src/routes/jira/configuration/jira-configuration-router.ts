import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraGet } from "routes/jira/jira-get";
import { JiraDelete } from "routes/jira/jira-delete";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jira-symmetric-jwt-middleware";
import { jiraAdminPermissionsMiddleware } from "middleware/jira-admin-permission-middleware";

export const JiraConfigurationRouter = Router();

JiraConfigurationRouter.route("/")
	.get(csrfMiddleware, jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraGet)
	.delete(jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraDelete);
