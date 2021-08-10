import {Installation} from "../models";
import {NextFunction, Request, Response} from "express";
import {TokenType, verifySymmetricJwtTokenMiddleware} from "../jira/util/jwt";
import {decodeSymmetric, getAlgorithm} from "atlassian-jwt";

const verifyTokenIsDecodableMiddleware = (sharedSecret: string, req: Request, next: NextFunction) => {
	try {
		const token = req.session.jwt || req.body?.token;
		// The JWT contains a `qsh` field that can be used to verify
		// the request body / query
		// See https://bitbucket.org/atlassian/atlassian-connect-express/src/f434e5a9379a41213acf53b9c2689ce5eec55e21/lib/middleware/authentication.js?at=master&fileviewer=file-view-default#authentication.js-227
		decodeSymmetric(token, sharedSecret, getAlgorithm(token));

		next();
	} catch (error) {
		next(new Error("Unauthorized"));
	}

}

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

	//TODO Add feature flag
	// if ( iframe-endpoints-authentication-fix-enabled ) {
	// eslint-disable-next-line no-constant-condition
	if (true) {
		verifySymmetricJwtTokenMiddleware(installation.sharedSecret, tokenType, req, res, next);
	} else {
		verifyTokenIsDecodableMiddleware(installation.sharedSecret, req, next);
	}

};

export const verifyJiraJwtTokenMiddleware = verifyJiraJwtMiddleware(TokenType.normal);

export const verifyJiraContextJwtTokenMiddleware = verifyJiraJwtMiddleware(TokenType.context);
