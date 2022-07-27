import { Router } from "express";
import { JiraConnectEnterpriseAppRouter } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-router";

export const JiraConnectEnterpriseRouter = Router();

JiraConnectEnterpriseRouter.use("/app", JiraConnectEnterpriseAppRouter);

