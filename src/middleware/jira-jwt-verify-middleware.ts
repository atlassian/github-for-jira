import { decodeSymmetric, getAlgorithm } from "atlassian-jwt";
import { NextFunction, Request, Response } from "express";
import { extractJwtFromRequest, TokenType, verifySymmetricJwtAndSetResponseCodeOnError } from "~/src/jira/util/jwt";
import { Installation } from "~/src/models/installation";

export const jiraJwtVerifyMiddleware = async (req: Request, res: Response, next: NextFunction) => {

	const token = extractJwtFromRequest(req);
	if (!token) {
		sendError(res, 401, "Could not find authentication data on request");
		return;
	}

	const issuer = getIssuer(token, res);
	if (!issuer) {
		sendError(res, 401, "JWT claim did not contain the issuer (iss) claim");
		return;
	}

	const installation = await Installation.getForClientKey(issuer);
	if (!installation) {
		sendError(res, 401, "No Installation found");
		return;
	}

	const secret = await installation.decrypt("encryptedSharedSecret");

	if (!verifySymmetricJwtAndSetResponseCodeOnError(token, secret, req, res, detectJwtTokenType(req))) {
		return;
	}
	res.locals.installation = installation;
	res.locals.jiraHost = installation.jiraHost;
	req.log.info("JWT Token Verified Successfully!");
	next();
};

const sendError = (res: Response, code: number, msg: string): void => {
	res.status(code).json({
		message: msg
	});
};


const getIssuer = (token: string, res: Response): string | undefined => {

	let unverifiedClaims;
	try {
		unverifiedClaims = decodeSymmetric(token, "", getAlgorithm(token), true); // decode without verification;
	} catch (e) {
		sendError(res, 401, `Invalid JWT: ${e.message}`);
		return;
	}

	const issuer = unverifiedClaims.iss;
	if (!issuer) {
		sendError(res, 401, "JWT claim did not contain the issuer (iss) claim");
		return;
	}
	return issuer;
};

const detectJwtTokenType = (req: Request): TokenType => {
	if (req.query.xdm_e) {
		return TokenType.normal;
	}
	return TokenType.context;
};
