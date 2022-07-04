import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraSelectVersionGet } from "./jira-select-version-get";
import { csrfMiddleware } from "middleware/csrf-middleware";

export const JiraSelectVersionRouter = Router();

JiraSelectVersionRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraSelectVersionGet);
