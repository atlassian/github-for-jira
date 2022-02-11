import { Router } from "express";
import { JiraConfigurationGet } from "./jira-configuration-get";
import { JiraConfigurationDelete } from "./jira-configuration-delete";
import { csrfMiddleware } from "../../../middleware/csrf-middleware";
import { JiraJwtTokenMiddleware } from "../../../middleware/jira-jwt-middleware";

export const JiraConfigurationRouter = Router();

JiraConfigurationRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConfigurationGet)
	.delete(JiraConfigurationDelete);
