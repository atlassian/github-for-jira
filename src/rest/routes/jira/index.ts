import { Router, Request, Response } from "express";
import { JiraCloudIDResponse } from "rest-interfaces";
import { JiraClient } from "models/jira-client";
import errorWrapper from "express-async-handler";

export const JiraCloudIDRouter = Router({ mergeParams: true });

JiraCloudIDRouter.get("/", errorWrapper(async function JiraCloudIDGet(req: Request, res: Response<JiraCloudIDResponse>) {

	const { installation } = res.locals;

	const jiraClient = await JiraClient.getNewClient(installation, req.log);
	const { cloudId } = await jiraClient.getCloudId();
	res.status(200).json({ cloudId });

}));

