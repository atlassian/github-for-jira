import express from "express";
import { JiraConfigurationRouter } from "./configuration/jira-configuration-router";
import { JiraSyncGet } from "./jira-sync-GET";

export const JiraRouter = express.Router();

JiraRouter.use("/configuration", JiraConfigurationRouter);
JiraRouter.get("/sync", JiraSyncGet);
