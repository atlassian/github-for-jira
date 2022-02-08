import express from "express";
import { ApiRouter } from "./api/api-router";
import { GithubRouter } from "./github/github-router";
import { JiraRouter } from "./jira/jira-router";
import { MaintenanceGet } from "./maintenance/maintenance-GET";
import { VersionGet } from "./version/version";
import { HealthcheckRouter } from "./healthcheck/healthcheck";

export const Router = express.Router();

Router.use("/api", ApiRouter);
Router.use("/github", GithubRouter);
Router.use("/jira", JiraRouter);
Router.use(HealthcheckRouter);

Router.get("/maintenance", MaintenanceGet);
Router.get("/version", VersionGet);
