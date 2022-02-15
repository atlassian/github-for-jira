import { Router } from "express";
import { JiraConfigurationRouter } from "./configuration/jira-configuration-router";
import { JiraSyncPost } from "./jira-sync-post";
import { JiraAtlassianConnectGet } from "./jira-atlassian-connect-get";
import { JiraEventsRouter } from "./events/jira-events-router";

export const JiraRouter = Router();

JiraRouter.get("/atlassian-connect.json", JiraAtlassianConnectGet);
JiraRouter.use("/configuration", JiraConfigurationRouter);
JiraRouter.post("/sync", JiraSyncPost);
JiraRouter.use("/events", JiraEventsRouter);
