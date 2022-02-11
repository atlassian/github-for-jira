import { Router } from "express";
import { JiraConfigurationRouter } from "./configuration/jira-configuration-router";
import { JiraSyncGet } from "./jira-sync-get";
import { JiraAtlassianConnectGet } from "./jira-atlassian-connect-get";
import { JiraEventsRouter } from "./events/jira-events-router";

export const JiraRouter = Router();

JiraRouter.get("/atlassian-connect.json", JiraAtlassianConnectGet);
JiraRouter.use("/configuration", JiraConfigurationRouter);
JiraRouter.get("/sync", JiraSyncGet);
JiraRouter.use("/events", JiraEventsRouter);
