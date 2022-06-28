import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraServerUrlGet } from "../server/jira-server-url-get";
import { csrfMiddleware } from "middleware/csrf-middleware";

export const JiraServerUrlRouter = Router();

JiraServerUrlRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraServerUrlGet);
