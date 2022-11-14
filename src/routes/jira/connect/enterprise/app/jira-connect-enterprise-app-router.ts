import { Router } from "express";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseAppDelete } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-delete";
import { JiraConnectEnterpriseAppPut } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-put";
import { JiraConnectEnterpriseAppPost } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-post";
import { JiraConnectEnterpriseAppCreateOrEdit } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit";
import { jiraJwtVerifyMiddleware } from "~/src/middleware/jira-jwt-middleware";

export const JiraConnectEnterpriseAppRouter = Router();

JiraConnectEnterpriseAppRouter.post("/", jiraJwtVerifyMiddleware, JiraConnectEnterpriseAppPost);

const routerWithUUID = Router({ mergeParams: true });
JiraConnectEnterpriseAppRouter.use("/:uuid", routerWithUUID);

routerWithUUID.use(GithubServerAppMiddleware);
routerWithUUID.route("")
	.get(csrfMiddleware, jiraJwtVerifyMiddleware, JiraConnectEnterpriseAppCreateOrEdit)
	.put(jiraJwtVerifyMiddleware, JiraConnectEnterpriseAppPut)
	.delete(jiraJwtVerifyMiddleware, JiraConnectEnterpriseAppDelete);
