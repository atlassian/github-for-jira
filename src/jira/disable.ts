import { Request, Response } from "express";

/**
 * Handle the disable webhook from Jira
 */
export default async (req: Request, res: Response): Promise<void> => {
	const { installation } = res.locals;
	await installation.disable();
	req.log.info("Installation disabled on Jira");
	res.sendStatus(204);
};
