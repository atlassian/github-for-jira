import { decodeSymmetric, getAlgorithm } from "atlassian-jwt";
import Logger from "bunyan";
import { NextFunction, Request, Response } from "express";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";
import { TokenType, verifyQsh } from "~/src/jira/util/jwt";
import { Installation } from "~/src/models/installation";
import { moduleUrls } from "~/src/routes/jira/atlassian-connect/jira-atlassian-connect-get";
import { matchRouteWithPattern } from "~/src/util/match-route-with-pattern";

export const jiraSymmetricJwtMiddleware = async (req: Request, res: Response, next: NextFunction) => {

	if (!await booleanFlag(BooleanFlags.NEW_JWT_VALIDATION, false)) {
		return next();
	}

	const token = req.query?.["jwt"] || req.cookies?.["jwt"];

	if (token) {
		const issuer = getIssuer(token, req.log);
		if (!issuer) {
			req.log.warn("JWT claim did not contain the issuer (iss) claim");
			return res.status(401).send("Unauthorised");
		}

		const installation = await Installation.getForClientKey(issuer);
		if (!installation) {
			req.log.warn("No Installation found");
			return res.status(401).send("Unauthorised");
		}

		const secret = await installation.decrypt("encryptedSharedSecret");

		const path = req.baseUrl == "" ? req.path : req.baseUrl;
		const tokenType = checkPathValidity(path) ? TokenType.normal : TokenType.context;
		try {
			verifySymmetricJwt(token, secret, req, tokenType, req.log);
		} catch (err) {
			req.log.warn({ err }, "Could not verify symmetric JWT");
			return res.status(401).send("Unauthorised");
		}

		res.locals.installation = installation;
		res.locals.jiraHost = installation.jiraHost;
		req.session.jiraHost = installation.jiraHost;

		if (req.cookies.jwt) {
			res.clearCookie("jwt");
		}
		return next();

	} else if (req.session?.jiraHost) {

		const installation = await Installation.getForHost(req.session.jiraHost);
		if (!installation) {
			req.log.warn("No Installation found");
			return res.status(401).send("Unauthorised");
		}

		res.locals.installation = installation;
		res.locals.jiraHost = installation.jiraHost;
		return next();
	}

	req.log.info("No Token found");
	return res.status(401).send("Unauthorised");

};

const getIssuer = (token: string, logger: Logger): string | undefined => {

	let unverifiedClaims;
	try {
		unverifiedClaims = decodeSymmetric(token, "", getAlgorithm(token), true); // decode without verification;
	} catch (err) {
		logger.warn({ err }, "Invalid JWT");
		throw new Error(`Invalid JWT: ${err.message}`);
	}

	return unverifiedClaims.iss;
};

const verifySymmetricJwt = (token: string, secret: string, req: Request, tokenType: TokenType, logger: Logger): boolean => {
	const algorithm = getAlgorithm(token);

	/* eslint-disable @typescript-eslint/no-explicit-any*/
	let verifiedClaims: any; //due to decodeSymmetric return any
	try {
		verifiedClaims = decodeSymmetric(token, secret, algorithm, false);
	} catch (err) {
		logger.warn({ err }, "Invalid JWT");
		throw new Error(`Unable to decode JWT token: ${err}`);
	}

	return verifyJwtClaims(verifiedClaims, tokenType, req);
};

export const verifyJwtClaims = (verifiedClaims: { exp: number, qsh: string }, tokenType: TokenType, req: Request): boolean => {
	const expiry = verifiedClaims.exp;

	if (expiry && (Date.now() / 1000 >= expiry)) {
		throw new Error("JWT Verification Failed, token is expired");
	}

	if (verifiedClaims.qsh) {
		let qshVerified: boolean;
		if (tokenType === TokenType.context) {
			//If we use context jsw tokens, their qsh will be constant
			qshVerified = verifiedClaims.qsh === "context-qsh";
		} else {
			//validate query string hash
			qshVerified = verifyQsh(verifiedClaims.qsh, req);
		}

		if (!qshVerified) {
			throw new Error("JWT Verification Failed, wrong qsh");
		}
		return qshVerified;

	} else {
		throw new Error("JWT Verification Failed, no qsh");
	}
};

/**
 * Checks if the URL matches any of the URL patterns defined in `moduleUrls`
 */
const checkPathValidity = (url: string) => {
	return moduleUrls.some(moduleUrl => {
		return matchRouteWithPattern(moduleUrl, url);
	});
};