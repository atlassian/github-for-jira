import express from "express";
import { JiraConfigurationGet } from "./jira-configuration-GET";
import { JiraConfigurationDelete } from "./jira-configuration-DELETE";

export const JiraConfigurationRouter = express.Router();

JiraConfigurationRouter.get("/", JiraConfigurationGet);
JiraConfigurationRouter.delete("/", JiraConfigurationDelete);
