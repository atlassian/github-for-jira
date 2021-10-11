import {Installation} from "../models";
import {NextFunction, Request, Response} from "express";
import {TokenType, verifySymmetricJwtTokenMiddleware} from "../jira/util/jwt";

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

	verifySymmetricJwtTokenMiddleware(installation.sharedSecret, tokenType, req, res, next);
};

export const verifyJiraJwtTokenMiddleware = verifyJiraJwtMiddleware(TokenType.normal);

export const verifyJiraContextJwtTokenMiddleware = verifyJiraJwtMiddleware(TokenType.context);
