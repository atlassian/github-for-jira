import { Router } from "express";
import { JiraContextJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseAppDelete } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-delete";

export const JiraConnectEnterpriseAppRouter = Router();

JiraConnectEnterpriseAppRouter.route("/:uuid")
	.delete(csrfMiddleware, JiraContextJwtTokenMiddleware, JiraConnectEnterpriseAppDelete);
