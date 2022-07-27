import { Router } from "express";
import { JiraConfigurationDelete } from "./jira-configuration-delete";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraGet } from "routes/jira/jira-get";

export const JiraConfigurationRouter = Router();

JiraConfigurationRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraGet)
	.delete(JiraContextJwtTokenMiddleware, JiraConfigurationDelete);
