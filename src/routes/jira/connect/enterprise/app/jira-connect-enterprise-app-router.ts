import { Router } from "express";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseAppDelete } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-delete";
import { JiraConnectEnterpriseAppPut } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-put";
import { JiraConnectEnterpriseAppPost } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-post";
import { JiraConnectEnterpriseAppCreateOrEditGet } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit-get";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jira-symmetric-jwt-middleware";
import { jiraAdminPermissionsMiddleware } from "middleware/jira-admin-permission-middleware";

export const JiraConnectEnterpriseAppRouter = Router();

JiraConnectEnterpriseAppRouter.use(jiraSymmetricJwtMiddleware);
JiraConnectEnterpriseAppRouter.use(jiraAdminPermissionsMiddleware);

JiraConnectEnterpriseAppRouter.post("/", JiraConnectEnterpriseAppPost);

const routerWithUUID = Router({ mergeParams: true });
JiraConnectEnterpriseAppRouter.use("/:uuid", routerWithUUID);

routerWithUUID.use(GithubServerAppMiddleware);
routerWithUUID.route("")
	.get(csrfMiddleware, JiraConnectEnterpriseAppCreateOrEditGet)
	.put(JiraConnectEnterpriseAppPut)
	.delete(JiraConnectEnterpriseAppDelete);
