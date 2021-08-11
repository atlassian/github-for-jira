import {Installation} from "../models";
import {NextFunction, Request, Response} from "express";

/**
 * Express middleware for connect app events
 *
 * Retrieves installation using clientKey and adds it to the res.locals
 *
 * @param req Request
 * @param res Response
 * @param next Next function
 */
export default async (req: Request, res: Response, next: NextFunction) => {
	const installation = await Installation.getForClientKey(req.body.clientKey);
	if (!installation) {
		res.status(404).json({});
		return;
	}

	const { jiraHost, clientKey } = installation;

	req.addLogFields({
		jiraHost,
		jiraClientKey: `${clientKey.substr(0, 5)}***}`
	});
	res.locals.installation = installation;
	next();
}
