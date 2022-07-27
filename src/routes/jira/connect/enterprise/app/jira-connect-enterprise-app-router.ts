import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import {
	JiraConnectEnterpriseAppCreateOrEdit
} from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit";

export const JiraConnectEnterpriseAppRouter = Router();

JiraConnectEnterpriseAppRouter.route("/:uuid")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseAppCreateOrEdit);