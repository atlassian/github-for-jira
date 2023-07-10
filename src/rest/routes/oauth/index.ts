import { Router, Request, Response } from "express";
import { getRedirectUrl } from "./service";

export const OAuthRouter = Router({ mergeParams: true });

OAuthRouter.get("/redirectUrl", async (req: Request, res: Response) => {
	res.status(200).json(await getRedirectUrl(req));
});

