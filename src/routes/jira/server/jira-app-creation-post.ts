import { NextFunction, Request, Response } from "express";

export const JiraAppCreationPost = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.info("IN HERE")
		// req.log.info(`Querying GHServerApps for existing GitHub apps with url: ${req.body}`);
		// take the provided url and query the GH Apps server table
		// if entry is found pass module key for that page (todo)
		// if no entry is found pass module key to that page
		res.sendStatus(200);
	} catch (error) {
		return next(new Error(`Something went wrong when querying the table: ${error}`));
	}
};
