import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraGet } from "routes/jira/jira-get";
import { JiraDelete } from "routes/jira/jira-delete";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jira-symmetric-jwt-middleware";

export const JiraConfigurationRouter = Router();

JiraConfigurationRouter.route("/")
	.get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraGet)
	.delete(jiraSymmetricJwtMiddleware, JiraDelete);
