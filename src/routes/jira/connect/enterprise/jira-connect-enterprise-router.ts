import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseGet } from "./jira-connect-enterprise-get";
import { JiraConnectEnterprisePost } from "routes/jira/connect/enterprise/jira-connect-enterprise-post";
import { JiraConnectEnterpriseDelete } from "routes/jira/connect/enterprise/jira-connect-enterprise-delete";
import { JiraConnectEnterpriseAppRouter } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-router";
import { JiraConnectEnterpriseServerAppGet } from "routes/jira/connect/enterprise/server_app/jira-connect-enterprise-server-app-get";
import { JiraConnectEnterpriseAppCreateOrEdit } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jira-symmetric-jwt-middleware";
import { jiraAdminPermissionsMiddleware } from "middleware/jira-admin-permission-middleware";

export const JiraConnectEnterpriseRouter = Router();

JiraConnectEnterpriseRouter.route("/")
	.get(csrfMiddleware, jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraConnectEnterpriseGet)
	.post(jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraConnectEnterprisePost)
	.delete(jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraConnectEnterpriseDelete);

JiraConnectEnterpriseRouter.use("/app", JiraConnectEnterpriseAppRouter);

JiraConnectEnterpriseRouter.get("/:serverUrl/app/new", csrfMiddleware, jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraConnectEnterpriseAppCreateOrEdit);

JiraConnectEnterpriseRouter.get("/:serverUrl/app", csrfMiddleware, jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, JiraConnectEnterpriseServerAppGet);

