import { Router } from "express";
import { JiraJwtTokenMiddleware, JiraContextJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseGet } from "./jira-connect-enterprise-get";
import { JiraConnectEnterprisePost } from "routes/jira/connect/enterprise/jira-connect-enterprise-post";
import { JiraConnectEnterpriseDelete } from "routes/jira/connect/enterprise/jira-connect-enterprise-delete";
import { JiraConnectEnterpriseAppRouter } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-router";
import { JiraConnectEnterpriseServerAppGet } from "routes/jira/connect/enterprise/server_app/jira-connect-enterprise-server-app-get";
import { JiraConnectEnterpriseAppCreateOrEdit } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit";

export const JiraConnectEnterpriseRouter = Router();

JiraConnectEnterpriseRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseGet)
	.post(JiraContextJwtTokenMiddleware, JiraConnectEnterprisePost)
	.delete(JiraContextJwtTokenMiddleware, JiraConnectEnterpriseDelete);

JiraConnectEnterpriseRouter.use("/app", JiraConnectEnterpriseAppRouter);

//eslint-disable-next-line @typescript-eslint/no-explicit-any
JiraConnectEnterpriseRouter.get("/:serverUrl/app/new", csrfMiddleware, JiraJwtTokenMiddleware as any, JiraConnectEnterpriseAppCreateOrEdit);

//eslint-disable-next-line @typescript-eslint/no-explicit-any
JiraConnectEnterpriseRouter.get("/:serverUrl/app", csrfMiddleware, JiraJwtTokenMiddleware as any, JiraConnectEnterpriseServerAppGet);

