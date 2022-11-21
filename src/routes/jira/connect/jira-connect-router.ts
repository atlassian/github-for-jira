import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectGet } from "./jira-connect-get";
import { JiraConnectEnterpriseRouter } from "./enterprise/jira-connect-enterprise-router";
import { JiraJwtTokenMiddleware } from "~/src/middleware/jira-jwt-middleware";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jiraSymmetricJwtMiddleware";

export const JiraConnectRouter = Router();

JiraConnectRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, jiraSymmetricJwtMiddleware, JiraConnectGet);

JiraConnectRouter.use("/enterprise", JiraConnectEnterpriseRouter);