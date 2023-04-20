import { Request, Response } from "express";

export const JiraWorkspaceGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for fetch org");



	res.status(200).json({ success: true });
};
