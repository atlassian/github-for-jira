import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseServerAppGet } from "routes/jira/connect/enterprise/server_app/jira-connect-enterprise-server-app-get";

export const JiraConnectEnterpriseRouter = Router();

JiraConnectEnterpriseRouter.get("/:serverUrl/app", csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseServerAppGet);