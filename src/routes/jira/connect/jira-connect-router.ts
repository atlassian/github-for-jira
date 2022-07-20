import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectGet } from "./jira-connect-get";
import { JiraConnectEnterpriseRouter } from "./enterprise/jira-connect-enterprise-router";

export const JiraConnectRouter = Router();

JiraConnectRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectGet);

JiraConnectRouter.use("/enterprise", JiraConnectEnterpriseRouter);


