import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseServerAppGet } from "routes/jira/enterprise/app-for-server/jira-connect-enterprise-server-app-get";
import { JiraConnectEnterpriseAppCreateOrEdit } from "routes/jira/enterprise/app/jira-connect-enterprise-app-create-or-edit";

export const JiraConnectEnterpriseServerAppRouter = Router();

JiraConnectEnterpriseServerAppRouter.use(csrfMiddleware);
JiraConnectEnterpriseServerAppRouter.use(JiraJwtTokenMiddleware);

JiraConnectEnterpriseServerAppRouter.route("/")
	.get(csrfMiddleware, JiraConnectEnterpriseServerAppGet);

JiraConnectEnterpriseServerAppRouter.route("/new")
	.get(csrfMiddleware, JiraConnectEnterpriseAppCreateOrEdit);