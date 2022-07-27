import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectGet } from "./jira-connect-get";

export const JiraConnectRouter = Router();

JiraConnectRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectGet);