import { Router } from "express";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseAppDelete } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-delete";
import { JiraConnectEnterpriseAppPut } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-put";
import { JiraConnectEnterpriseAppPost } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-post";
import { JiraConnectEnterpriseAppCreateOrEdit } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit";

export const JiraConnectEnterpriseAppRouter = Router();

JiraConnectEnterpriseAppRouter.post("/", JiraContextJwtTokenMiddleware, JiraConnectEnterpriseAppPost);

const routerWithUUID = Router({ mergeParams: true });
JiraConnectEnterpriseAppRouter.use("/:uuid", routerWithUUID);

routerWithUUID.use(GithubServerAppMiddleware);
routerWithUUID.route("")
	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	.get(csrfMiddleware, JiraJwtTokenMiddleware as any, JiraConnectEnterpriseAppCreateOrEdit)
	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	.put(JiraContextJwtTokenMiddleware as any, JiraConnectEnterpriseAppPut)
	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	.delete(JiraContextJwtTokenMiddleware as any, JiraConnectEnterpriseAppDelete);
