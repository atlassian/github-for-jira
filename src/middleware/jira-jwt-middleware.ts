import { decodeSymmetric, getAlgorithm } from "atlassian-jwt";
import { NextFunction, Request, Response } from "express";
import { extractJwtFromRequest, TokenType, verifySymmetricJwtAndSetResponseCodeOnError } from "~/src/jira/util/jwt";
import { Installation } from "~/src/models/installation";

export const jiraHostMiddleware = async (req: Request, res: Response, next: NextFunction) => {

	const token = extractJwtFromRequest(req);

	if (!token) {
		if (req.session.jiraHost) {
			res.locals.jiraHost = req.session.jiraHost;
			next();
			return;
		}
		next();
		return;
	}

	const installation = await getInstallationAndTokenVerification(token, req, res);
	if (!installation) {
		return;
	}

	res.locals.installation = installation;
	res.locals.jiraHost = installation.jiraHost;
	res.locals.jwtVerified = true;

	if (req.cookies.jwt) {
		req.session.jiraHost = installation.jiraHost;
		res.clearCookie("jwt");
	}

	next();
};

export const jiraJwtVerifyMiddleware = async (req: Request, res: Response, next: NextFunction) => {

	const token = extractJwtFromRequest(req);

	if (!token) {
		sendError(res, 401, "Could not find authentication data on request");
		return;
	}

	// if token is alreafy verified, skip verification
	if (res.locals.jwtVerified) {
		next();
		return;
	}

	if (!getInstallationAndTokenVerification(token, req, res)) {
		return;
	}
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

	return unverifiedClaims.iss;
};

const detectJwtTokenType = (req: Request): TokenType => {
	if (req.query.xdm_e) {
		return TokenType.normal;
	}
	return TokenType.context;
};

const getInstallationAndTokenVerification = async (token: string, req: Request, res: Response): Promise<Installation | null> => {
	const issuer = getIssuer(token, res);
	if (!issuer) {
		sendError(res, 401, "JWT claim did not contain the issuer (iss) claim");
		return null;
	}

	const installation = await Installation.getForClientKey(issuer);
	if (!installation) {
		sendError(res, 401, "No Installation found");
		return null;
	}

	const secret = await installation.decrypt("encryptedSharedSecret");

	if (verifySymmetricJwtAndSetResponseCodeOnError(token, secret, req, res, detectJwtTokenType(req))) {
		return installation;
	}
	return null;
};