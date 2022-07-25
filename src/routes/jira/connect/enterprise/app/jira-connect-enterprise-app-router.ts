import { Router } from "express";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import {
	JiraConnectEnterpriseAppCreateOrEdit
} from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit";
import { JiraConnectEnterpriseAppPost } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-post";
import { JiraConnectEnterpriseAppPut } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-put";
import { JiraConnectEnterpriseAppDelete } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-delete";

export const JiraConnectEnterpriseAppRouter = Router();

JiraConnectEnterpriseAppRouter.post("/", csrfMiddleware, JiraContextJwtTokenMiddleware, JiraConnectEnterpriseAppPost);

JiraConnectEnterpriseAppRouter.route("/:uuid")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseAppCreateOrEdit)
	.put(csrfMiddleware, JiraContextJwtTokenMiddleware, JiraConnectEnterpriseAppPut)
	.delete(csrfMiddleware, JiraContextJwtTokenMiddleware, JiraConnectEnterpriseAppDelete);
