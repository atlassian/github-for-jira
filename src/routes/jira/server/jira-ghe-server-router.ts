import { Router } from "express";
import { JiraGheServers } from "routes/jira/server/jira-ghe-servers";
import { JiraGheServerApps } from "routes/jira/server/jira-ghe-server-apps";

export const JiraGheServerRouter = Router();

JiraGheServerRouter.get("/", JiraGheServers);
JiraGheServerRouter.get("/apps", JiraGheServerApps);