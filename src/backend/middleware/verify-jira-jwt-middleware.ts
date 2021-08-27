import {Installation} from "../models";
import {NextFunction, Request, Response} from "express";
import {TokenType, verifySymmetricJwtTokenMiddleware} from "../../common/jwt";
import {decodeSymmetric, getAlgorithm} from "atlassian-jwt";
import { booleanFlag, BooleanFlags } from "../../config/feature-flags";

const verifyTokenIsDecodableMiddleware = (sharedSecret: string, req: Request, next: NextFunction) => {
	try {
		const token = req.session.jwt || req.body?.token || req.query.jwt;

		if(!token) {
			next(new Error("Unauthorized"));
			return
		}

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

	if (await booleanFlag(BooleanFlags.FIX_IFRAME_ENDPOINTS_JWT, false, jiraHost)) {
		verifySymmetricJwtTokenMiddleware(installation.sharedSecret, tokenType, req, res, next);
	} else {
		verifyTokenIsDecodableMiddleware(installation.sharedSecret, req, next);
	}

};

export const verifyJiraJwtTokenMiddleware = verifyJiraJwtMiddleware(TokenType.normal);

export const verifyJiraContextJwtTokenMiddleware = verifyJiraJwtMiddleware(TokenType.context);
