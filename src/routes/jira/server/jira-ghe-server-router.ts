import { Router } from "express";
import { JiraGheServers } from "routes/jira/server/jira-ghe-servers";
import { JiraGheServerApps } from "routes/jira/server/jira-ghe-server-apps";
import { JiraEditAppGet } from "routes/jira/server/jira-edit-app-get";

export const JiraGheServerRouter = Router();

JiraGheServerRouter.get("/", JiraGheServers);
JiraGheServerRouter.get("/apps", JiraGheServerApps);
JiraGheServerRouter.get("/edit-app/:id", JiraEditAppGet);