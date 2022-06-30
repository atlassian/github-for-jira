import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraAppCreationGet } from "./jira-app-creation-get";
import { csrfMiddleware } from "middleware/csrf-middleware";

export const JiraAppCreationRouter = Router();

JiraAppCreationRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraAppCreationGet);
