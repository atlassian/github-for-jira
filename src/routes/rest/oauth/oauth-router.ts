import { Router, Request, Response } from "express";
import { getRedirectUrl } from "./oauth-service";

export const OAuthRouter = Router({ mergeParams: true });

OAuthRouter.post("/redirecturl", async (_req: Request, res: Response) => {
	const { jiraHost } = res.locals;
	const data = await getRedirectUrl(jiraHost);
	res.status(200).json(data);
});

