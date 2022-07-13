import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraGheServers } from "routes/jira/server/jira-ghe-servers";

export const JiraGheServersRouter = Router();

JiraGheServersRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraGheServers);
