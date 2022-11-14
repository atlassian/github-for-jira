import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraGet } from "routes/jira/jira-get";
import { JiraDelete } from "routes/jira/jira-delete";
import { jiraJwtVerifyMiddleware } from "~/src/middleware/jira-jwt-middleware";

export const JiraConfigurationRouter = Router();

JiraConfigurationRouter.route("/")
	.get(csrfMiddleware, jiraJwtVerifyMiddleware, JiraGet)
	.delete(jiraJwtVerifyMiddleware, JiraDelete);
