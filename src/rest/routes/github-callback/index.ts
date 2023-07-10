import { Router, Request, Response } from "express";
import { getAccessToken } from "~/src/rest/routes/github-callback/service";

export const GitHubCallbackRoute = Router({ mergeParams: true });

GitHubCallbackRoute.get("/", async (req: Request, res: Response) => {
	res.status(200).json({
		data: await getAccessToken(req, res)
	});
});

