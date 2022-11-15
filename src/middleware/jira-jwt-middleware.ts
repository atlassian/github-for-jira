import { decodeSymmetric, getAlgorithm } from "atlassian-jwt";
import { NextFunction, Request, Response } from "express";
import { extractJwtFromRequest, TokenType, verifySymmetricJwt } from "~/src/jira/util/jwt";
import { Installation } from "~/src/models/installation";

export const jiraHostMiddleware = async (req: Request, res: Response, next: NextFunction) => {

	const token = extractJwtFromRequest(req);

	if (!token) {
		if (req.session.jiraHost) {
			res.locals.jiraHost = req.session.jiraHost;
			return next();
		}
		return next();
	}

	let installation;
	try {
		installation = await getInstallationAndTokenVerification(token, req);
	} catch (err) {
		req.log.info(err);
	}

	if (installation) {
		res.locals.installation = installation;
		res.locals.jiraHost = installation.jiraHost;
		res.locals.jwtVerified = true;
	}

	if (req.cookies.jwt) {
		req.session.jiraHost = installation.jiraHost;
		res.clearCookie("jwt");
	}

	next();
};

export const jiraJwtVerifyMiddleware = async (req: Request, res: Response, next: NextFunction) => {

	const token = extractJwtFromRequest(req);

	if (!token) {
		return next(new Error("Could not find authentication data on request"));
	}

	// if token is alreafy verified, skip verification
	if (res.locals.jwtVerified) {
		return next();
	}

	try {
		await getInstallationAndTokenVerification(token, req);
	} catch (err) {
		return next(err);
	}
	next();
};

const getIssuer = (token: string): string | undefined => {

	let unverifiedClaims;
	try {
		unverifiedClaims = decodeSymmetric(token, "", getAlgorithm(token), true); // decode without verification;
	} catch (e) {
		throw new Error(`Invalid JWT: ${e.message}`);
	}

	return unverifiedClaims.iss;
};

const detectJwtTokenType = (req: Request): TokenType => {
	if (req.query.xdm_e) {
		return TokenType.normal;
	}
	return TokenType.context;
};

const getInstallationAndTokenVerification = async (token: string, req: Request): Promise<Installation | null> => {
	const issuer = getIssuer(token);
	if (!issuer) {
		throw new Error("JWT claim did not contain the issuer (iss) claim");
	}

	const installation = await Installation.getForClientKey(issuer);
	if (!installation) {
		throw new Error("No Installation found");
	}

	const secret = await installation.decrypt("encryptedSharedSecret");

	verifySymmetricJwt(token, secret, req, detectJwtTokenType(req));
	return installation;
};