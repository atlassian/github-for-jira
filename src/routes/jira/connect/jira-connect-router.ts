import { Router } from "express";
import { JiraConnectEnterpriseRouter } from "./enterprise/jira-connect-enterprise-router";

export const JiraConnectRouter = Router();

JiraConnectRouter.use("/enterprise", JiraConnectEnterpriseRouter);