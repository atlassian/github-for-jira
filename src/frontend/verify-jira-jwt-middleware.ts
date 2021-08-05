import { Installation } from "../models";
import { NextFunction, Request, Response } from "express";
import {hasValidJwt, TokenType} from "../jira/util/jwt";

const verifyJiraJwtMiddleware = (tokenType: TokenType) => async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	const jiraHost = req.session.jiraHost || req.body?.jiraHost;
	const installation = await Installation.getForHost(jiraHost);

	if (!installation) {
		return next(new Error("Not Found"));
	}
	res.locals.installation = installation;

	req.addLogFields({
		jiraHost: installation.jiraHost,
		jiraClientKey:
			installation.clientKey && `${installation.clientKey.substr(0, 5)}***`
	});

	try {
		if (!hasValidJwt(installation.sharedSecret, req, res, tokenType)) {
			return
		}
		next();
	} catch (error) {
		req.log.error(error, "Error happened when validating JWT token")
		next(new Error("Unauthorized"));
	}
};

export default verifyJiraJwtMiddleware
