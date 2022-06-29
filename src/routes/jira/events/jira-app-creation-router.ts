import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraAppCreationPost } from "../server/jira-app-creation-post";
import { JiraAppCreationGet } from "../server/jira-app-creation-get";
import { csrfMiddleware } from "middleware/csrf-middleware";

export const JiraAppCreationRouter = Router();

JiraAppCreationRouter.route("/")
	.post(JiraAppCreationPost)
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraAppCreationGet);
