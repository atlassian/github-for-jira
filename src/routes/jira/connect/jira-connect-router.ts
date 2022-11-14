import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectGet } from "./jira-connect-get";
import { JiraConnectEnterpriseRouter } from "./enterprise/jira-connect-enterprise-router";
import { jiraJwtVerifyMiddleware } from "~/src/middleware/jira-jwt-middleware";

export const JiraConnectRouter = Router();

JiraConnectRouter.route("/")
	.get(csrfMiddleware, jiraJwtVerifyMiddleware, JiraConnectGet);

JiraConnectRouter.use("/enterprise", JiraConnectEnterpriseRouter);