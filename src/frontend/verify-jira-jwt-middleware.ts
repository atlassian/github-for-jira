import { Installation } from "../models";
import { NextFunction, Request, Response } from "express";
import { sendError, TokenType, verifyAsymmetricJwtTokenMiddleware, verifySymmetricJwtTokenMiddleware } from "../jira/util/jwt";

const verifyJiraJwtMiddleware = (tokenType: TokenType) => async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	const { jiraHost } = res.locals;

	if (!jiraHost) {
		sendError(res, 401, "Unauthorised");
		return;
	}

	const installation = await Installation.getForHost(jiraHost);

	if (!installation) {
		return next(new Error("Not Found"));
	}
	// TODO: Probably not the best place to set things globally
	res.locals.installation = installation;

	req.addLogFields({
		jiraHost: installation.jiraHost,
		jiraClientKey:
			installation.clientKey && `${installation.clientKey.substr(0, 5)}***`
	});

	verifySymmetricJwtTokenMiddleware(
		installation.sharedSecret,
		tokenType,
		req,
		res,
		next);
};

export const verifyJiraJwtTokenMiddleware = verifyJiraJwtMiddleware(TokenType.normal);

export const verifyJiraContextJwtTokenMiddleware = verifyJiraJwtMiddleware(TokenType.context);
export const authenticateJiraEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	verifySymmetricJwtTokenMiddleware(res.locals.installation.sharedSecret, TokenType.normal, req, res, next);
};
export const authenticateUninstallCallback = verifyAsymmetricJwtTokenMiddleware;
export const authenticateInstallCallback = verifyAsymmetricJwtTokenMiddleware;
