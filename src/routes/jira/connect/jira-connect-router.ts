import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectGet } from "./jira-connect-get";
import { JiraConnectEnterpriseRouter } from "./enterprise/jira-connect-enterprise-router";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jira-symmetric-jwt-middleware";
import { jiraAdminPermissionsMiddleware } from "middleware/jira-admin-permission-middleware";

export const JiraConnectRouter = Router();

JiraConnectRouter.route("/")
	.get(csrfMiddleware, jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraConnectGet);

JiraConnectRouter.use("/enterprise", JiraConnectEnterpriseRouter);
