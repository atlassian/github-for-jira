import { Router, Request, Response } from "express";
import { errorWrapper } from "../../helper";
import { getAllSubscriptions } from "./service";

export const SubscriptionsRouter = Router();

SubscriptionsRouter.get("/", errorWrapper("SubscriptionsGet", async (_req: Request, res: Response) => {
	const { jiraHost, installation } = res.locals;
	const { ghCloudSubscriptions, ghEnterpriseServers } = await getAllSubscriptions(jiraHost, installation.id);

	res.status(200).json({
		ghCloudSubscriptions,
		ghEnterpriseServers
	});
}));

