import { Installation } from "../backend/models";
import { hasValidJwt } from "./util/jwt";
import { NextFunction, Request, Response } from "express";

export default async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	const installation = await Installation.getForClientKey(req.body.clientKey);
	if (!installation) {
		res.status(404).json({});
		return;
	}

	const { jiraHost, sharedSecret, clientKey } = installation;

	req.addLogFields({
		jiraHost,
		jiraClientKey: `${clientKey.substr(0, 5)}***}`
	});
	res.locals.installation = installation;

	// TODO: Should the express response logic be inside 'hasValidJwt'?
	if (hasValidJwt(sharedSecret, jiraHost, req, res)) {
		next();
	}
};
