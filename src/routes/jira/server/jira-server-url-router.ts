import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraServerUrlGet } from "./jira-server-url-get";
import { JiraServerUrlPost } from "./jira-server-url-post";
import { csrfMiddleware } from "middleware/csrf-middleware";

export const JiraServerUrlRouter = Router();

JiraServerUrlRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraServerUrlGet)
	.post(csrfMiddleware, JiraJwtTokenMiddleware, JiraServerUrlPost);
