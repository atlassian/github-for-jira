import { Router } from "express";
import { JiraContextJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraConnectEnterprisePost } from "routes/jira/connect/enterprise/jira-connect-enterprise-post";

export const JiraConnectEnterpriseRouter = Router();

JiraConnectEnterpriseRouter.post("/", JiraContextJwtTokenMiddleware, JiraConnectEnterprisePost);
