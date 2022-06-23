import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraSelectGet } from "routes/jira/select/jira-select-get";

export const JiraSelectRouter = Router();

JiraSelectRouter.route("/")
	.post(JiraSelectGet)
