import { Installation } from "models/installation";
import { NextFunction, Request, Response } from "express";

type ResponseType =  Response<
	never,
	JiraJwtVerifiedLocals
>;
/**
 * Express middleware for connect app events
 *
 * Retrieves installation using clientKey and adds it to the res.locals
 *
 * @param req Request
 * @param res Response
 * @param next Next function
 */
export const extractInstallationFromJiraCallback = async (req: Request, res: ResponseType, next: NextFunction) => {
	if (!req.body?.clientKey) {
		res.status(401);
		return;
	}

	const installation = await Installation.getForClientKey(req.body.clientKey);
	if (!installation) {
		res.status(404);
		return;
	}

	const { jiraHost, clientKey } = installation;

	req.addLogFields({
		jiraHost,
		jiraClientKey: `${clientKey.substr(0, 5)}***}`
	});
	res.locals.installation = installation;
	next();
};
