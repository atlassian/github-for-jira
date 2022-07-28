import { Router } from "express";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseAppDelete } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-delete";
import { JiraConnectEnterpriseAppCreateOrEdit } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit";

export const JiraConnectEnterpriseAppRouter = Router();

JiraConnectEnterpriseAppRouter.route("/:uuid")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseAppCreateOrEdit)
	.delete(csrfMiddleware, JiraContextJwtTokenMiddleware, JiraConnectEnterpriseAppDelete);
