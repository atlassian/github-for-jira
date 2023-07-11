import { Router, Request, Response } from "express";
import { getRedirectUrl } from "./service";

export const OAuthRouter = Router({ mergeParams: true });

OAuthRouter.get("/redirectUrl", async (req: Request, res: Response) => {

	const cloudOrUUID = req.params.cloudOrUUID;

	const gheUUID = cloudOrUUID === "cloud" ? undefined : "some-ghe-uuid"; //TODO: validate the uuid regex

	res.status(200).json(await getRedirectUrl(gheUUID));
});

