import { Router } from "express";
import { JiraJwtTokenMiddleware, JiraContextJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseGet } from "./jira-connect-enterprise-get";
import { JiraConnectEnterprisePost } from "routes/jira/connect/enterprise/jira-connect-enterprise-post";

export const JiraConnectEnterpriseRouter = Router();

JiraConnectEnterpriseRouter.route("/").get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseGet);

JiraConnectEnterpriseRouter.post("/", JiraContextJwtTokenMiddleware, JiraConnectEnterprisePost);
