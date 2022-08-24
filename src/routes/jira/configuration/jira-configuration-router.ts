import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraGet } from "routes/jira/jira-get";
import { JiraDelete } from "routes/jira/jira-delete";

export const JiraConfigurationRouter = Router();

JiraConfigurationRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraGet)
	.delete(JiraContextJwtTokenMiddleware, JiraDelete);
