import { Router } from "express";
import { JiraConfigurationGet } from "./jira-configuration-get";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraDelete } from "routes/jira/jira-delete";

export const JiraConfigurationRouter = Router();

JiraConfigurationRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConfigurationGet)
	.delete(JiraContextJwtTokenMiddleware, JiraDelete);
