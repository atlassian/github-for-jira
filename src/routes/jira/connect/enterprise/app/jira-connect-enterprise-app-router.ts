import { Router } from "express";
import { JiraContextJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseAppPost } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-post";
import { JiraConnectEnterpriseAppPut } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-put";
import { JiraConnectEnterpriseAppDelete } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-delete";

export const JiraConnectEnterpriseAppRouter = Router();

JiraConnectEnterpriseAppRouter.post("/", csrfMiddleware, JiraContextJwtTokenMiddleware, JiraConnectEnterpriseAppPost);

JiraConnectEnterpriseAppRouter.route("/:uuid")
	.put(csrfMiddleware, JiraContextJwtTokenMiddleware, JiraConnectEnterpriseAppPut)
	.delete(csrfMiddleware, JiraContextJwtTokenMiddleware, JiraConnectEnterpriseAppDelete);