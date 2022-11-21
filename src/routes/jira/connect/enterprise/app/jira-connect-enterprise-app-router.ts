import { Router } from "express";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseAppDelete } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-delete";
import { JiraConnectEnterpriseAppPut } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-put";
import { JiraConnectEnterpriseAppPost } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-post";
import { JiraConnectEnterpriseAppCreateOrEdit } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "~/src/middleware/jira-jwt-middleware";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jiraSymmetricJwtMiddleware";

export const JiraConnectEnterpriseAppRouter = Router();

JiraConnectEnterpriseAppRouter.post("/", JiraContextJwtTokenMiddleware, jiraSymmetricJwtMiddleware, JiraConnectEnterpriseAppPost);

const routerWithUUID = Router({ mergeParams: true });
JiraConnectEnterpriseAppRouter.use("/:uuid", routerWithUUID);

routerWithUUID.use(GithubServerAppMiddleware);
routerWithUUID.route("")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, jiraSymmetricJwtMiddleware, JiraConnectEnterpriseAppCreateOrEdit)
	.put(JiraContextJwtTokenMiddleware, jiraSymmetricJwtMiddleware, JiraConnectEnterpriseAppPut)
	.delete(JiraContextJwtTokenMiddleware, jiraSymmetricJwtMiddleware, JiraConnectEnterpriseAppDelete);
