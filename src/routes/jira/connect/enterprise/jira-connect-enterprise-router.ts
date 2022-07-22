import { Router } from "express";
import { JiraContextJwtTokenMiddleware, JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseGet } from "./jira-connect-enterprise-get";
import { JiraConnectEnterprisePost } from "routes/jira/connect/enterprise/jira-connect-enterprise-post";
import { JiraConnectEnterpriseAppRouter } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-router";
import { JiraConnectEnterpriseServerAppGet } from "routes/jira/connect/enterprise/server_app/jira-connect-enterprise-server-app-get";
import { JiraConnectEnterpriseAppCreateOrEdit } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit";

export const JiraConnectEnterpriseRouter = Router();

JiraConnectEnterpriseRouter.post("/", JiraContextJwtTokenMiddleware, JiraConnectEnterprisePost);


JiraConnectEnterpriseRouter.use(csrfMiddleware).use(JiraJwtTokenMiddleware);

JiraConnectEnterpriseRouter.route("/").get(JiraConnectEnterpriseGet);

JiraConnectEnterpriseRouter.use("/app", JiraConnectEnterpriseAppRouter);

JiraConnectEnterpriseRouter.get("/:serverUrl/app/new", JiraConnectEnterpriseAppCreateOrEdit);

JiraConnectEnterpriseRouter.get("/:serverUrl/app", JiraConnectEnterpriseServerAppGet);


