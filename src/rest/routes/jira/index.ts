import { Router, Request, Response } from "express";
import { JiraCloudIDResponse, ErrorResponse } from "rest-interfaces/oauth-types";
import { JiraClient } from "models/jira-client";

export const JiraCloudIDRouter = Router({ mergeParams: true });

JiraCloudIDRouter.get("/", async function JiraCloudIDGet(req: Request, res: Response<JiraCloudIDResponse | ErrorResponse>) {

	const { installation } = res.locals;

	try {
		const jiraClient = await JiraClient.getNewClient(installation, req.log);
		const { cloudId } = await jiraClient.getCloudId();
		res.status(200).json({ cloudId });
	} catch (e) {
		req.log.error({ err: e }, "Error fetching cloud id");
		res.status(500).json({ errorType: "error", reason: "Fail to fetch cloud id" });
	}
});

