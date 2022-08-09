import { Router } from "express";
import { JiraJwtTokenMiddleware, JiraContextJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseGet } from "./jira-connect-enterprise-get";
import { JiraConnectEnterprisePost } from "routes/jira/connect/enterprise/jira-connect-enterprise-post";
import { JiraConnectEnterpriseAppRouter } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-router";
import { JiraConnectEnterpriseServerAppGet } from "routes/jira/connect/enterprise/server_app/jira-connect-enterprise-server-app-get";
import { JiraConnectEnterpriseServerAppDelete } from "routes/jira/connect/enterprise/server_app/jira-connect-enterprise-server-app-delete";
import { JiraConnectEnterpriseAppCreateOrEdit } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-create-or-edit";

export const JiraConnectEnterpriseRouter = Router();

JiraConnectEnterpriseRouter.post("/", JiraContextJwtTokenMiddleware, JiraConnectEnterprisePost);

JiraConnectEnterpriseRouter.route("/").get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseGet);

JiraConnectEnterpriseRouter.use("/app", JiraConnectEnterpriseAppRouter);

JiraConnectEnterpriseRouter.get("/:serverUrl/app/new", csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseAppCreateOrEdit);

JiraConnectEnterpriseRouter.get("/:serverUrl/app", csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseServerAppGet);
JiraConnectEnterpriseRouter.delete("/", JiraJwtTokenMiddleware, JiraConnectEnterpriseServerAppDelete);
