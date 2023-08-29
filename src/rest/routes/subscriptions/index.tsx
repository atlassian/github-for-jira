import { Router, Request, Response } from "express";
import { errorWrapper } from "../../helper";

export const SubscriptionsRouter = Router();

SubscriptionsRouter.get("/", errorWrapper("SubscriptionsGet", async (_req: Request, res: Response) => {
	res.status(200).json({
		success: true
	});
}));

