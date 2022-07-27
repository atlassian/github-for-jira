import { Router } from "express";
import { JiraJwtTokenMiddleware, JiraContextJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseGet } from "./jira-connect-enterprise-get";
import { JiraConnectEnterprisePost } from "routes/jira/connect/enterprise/jira-connect-enterprise-post";
import { JiraConnectEnterpriseServerAppGet } from "routes/jira/connect/enterprise/server_app/jira-connect-enterprise-server-app-get";

export const JiraConnectEnterpriseRouter = Router();

JiraConnectEnterpriseRouter.post("/", JiraContextJwtTokenMiddleware, JiraConnectEnterprisePost);

JiraConnectEnterpriseRouter.route("/").get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseGet);

JiraConnectEnterpriseRouter.get("/:serverUrl/app", csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseServerAppGet);