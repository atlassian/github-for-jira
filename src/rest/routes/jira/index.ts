import { Router, Request, Response, NextFunction } from "express";
import { JiraCloudIDResponse } from "rest-interfaces/oauth-types";
import { JiraClient } from "models/jira-client";

export const JiraCloudIDRouter = Router({ mergeParams: true });

JiraCloudIDRouter.get("/", async function JiraCloudIDGet(req: Request, res: Response<JiraCloudIDResponse>, next: NextFunction) {

	const { installation } = res.locals;

	try {
		const jiraClient = await JiraClient.getNewClient(installation, req.log);
		const { cloudId } = await jiraClient.getCloudId();
		res.status(200).json({ cloudId });
	} catch (e) {
		req.log.error({ err: e }, "Failed to fetch cloud id");
		next(e);
	}
});

