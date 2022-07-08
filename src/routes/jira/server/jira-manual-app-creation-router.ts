import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraManualAppCreationGet } from "./jira-manual-app-creation-get";
import { csrfMiddleware } from "middleware/csrf-middleware";

export const JiraManualAppCreationRouter = Router();

JiraManualAppCreationRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraManualAppCreationGet);
