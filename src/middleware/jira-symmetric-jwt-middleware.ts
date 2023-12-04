import { AsymmetricAlgorithm, SymmetricAlgorithm, decodeSymmetric, getAlgorithm } from "atlassian-jwt";
import Logger from "bunyan";
import { NextFunction, Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { getJWTRequest, TokenType, validateQsh } from "~/src/jira/util/jwt";
import { Installation } from "~/src/models/installation";
import {
	getGenericContainerUrls,
	moduleUrls,
	getSecurityContainerActionUrls
} from "~/src/routes/jira/atlassian-connect/jira-atlassian-connect-get";
import { matchRouteWithPattern } from "~/src/util/match-route-with-pattern";
import { fetchAndSaveUserJiraAdminStatus } from "middleware/jira-admin-permission-middleware";
import { envVars } from "~/src/config/env";
import { errorStringFromUnknown } from "../util/error-string-from-unknown";
import { BaseLocals } from "../rest/routes";

export const jiraSymmetricJwtMiddleware = async (req: Request<ParamsDictionary, unknown, { jwt?: string }, { jwt?: string }, BaseLocals>, res: Response, next: NextFunction) => {
	const authHeader = req.headers["authorization"] as string;
	const authHeaderPrefix = "JWT ";
	const cookies = req.cookies as { jwt?: string };
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	const token = req.query?.jwt || cookies?.jwt || req.body?.jwt || authHeader?.startsWith(authHeaderPrefix) && authHeader.substring(authHeaderPrefix.length);
	if (token) {
		let issuer: string | undefined;
		try {
			issuer = getIssuer(token, req.log);
		} catch (err: unknown) {
			req.log.warn({ err }, "Could not get issuer");
			return res.status(401).send("Unauthorised");
		}
		const installation = await Installation.getForClientKey(issuer);
		if (!installation) {
			req.log.warn("No Installation found");
			return res.status(401).send("Unauthorised");
		}
		let verifiedClaims: Record<string, string | number>;
		try {
			verifiedClaims = await verifySymmetricJwt(req, token, installation);
		} catch (err: unknown) {
			req.log.warn({ err }, "Could not verify symmetric JWT");
			const errorMessage = req.path === "/create-branch-options" ? "Create branch link expired" : "Unauthorised";
			return res.status(401).send(errorMessage);
		}

		res.locals.installation = installation;
		res.locals.jiraHost = installation.jiraHost;
		req.session.jiraHost = installation.jiraHost;
		// Check whether logged-in user has Jira Admin permissions and save it to the session
		await fetchAndSaveUserJiraAdminStatus(req, verifiedClaims, installation);

		if (cookies.jwt) {
			res.clearCookie("jwt");
		}
		req.addLogFields({ jiraHost: installation.jiraHost });
		next(); return;

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	} else if (req.session?.jiraHost) {

		const installation = await Installation.getForHost(req.session.jiraHost);
		if (!installation) {
			req.log.warn("No Installation found");
			req.session.jiraHost = undefined;
			return res.status(401).send("Unauthorised");
		}

		res.locals.installation = installation;
		res.locals.jiraHost = installation.jiraHost;
		req.addLogFields({ jiraHost: installation.jiraHost });
		next(); return;
	}

	req.log.warn("No token found and session cookie has no jiraHost");

	return res.status(401).send("Unauthorised");

};

const getIssuer = (token: string, logger: Logger): string | undefined => {

	let unverifiedClaims: { iss?: string };
	try {
		const algorithm = getAlgorithm(token) as AsymmetricAlgorithm | SymmetricAlgorithm;
		unverifiedClaims = decodeSymmetric(token, "", algorithm, true) as { iss?: string }; // decode without verification;
	} catch (err: unknown) {
		logger.warn({ err }, "Invalid JWT");
		throw new Error(`Invalid JWT: ${errorStringFromUnknown(err)}`);
	}

	if (!unverifiedClaims.iss) {
		throw new Error("JWT claim did not contain the issuer (iss) claim");
	}

	return unverifiedClaims.iss;
};

export const getTokenType = (url: string, method: string): TokenType =>
	checkPathValidity(url) && method == "GET"
		|| checkGenericContainerActionUrl(`${envVars.APP_URL}${url}`)
		|| checkSecurityContainerActionUrl(`${envVars.APP_URL}${url}`) ? TokenType.normal
		: TokenType.context;

const verifySymmetricJwt = async (req: Request, token: string, installation: Installation) => {
	const algorithm = getAlgorithm(token) as AsymmetricAlgorithm | SymmetricAlgorithm;
	const secret = await installation.decrypt("encryptedSharedSecret", req.log);

	try {
		const claims = decodeSymmetric(token, secret, algorithm, false) as Record<string, string | number>;
		const tokenType = getTokenType(req.originalUrl, req.method);

		verifyJwtClaims(claims, tokenType, req);
		return claims;
	} catch (err: unknown) {
		req.log.warn({ err }, "Invalid JWT");
		throw new Error(`Unable to decode JWT token: ${errorStringFromUnknown(err)}`);
	}
};

export const verifyJwtClaims = (verifiedClaims: { exp?: number, qsh?: string }, tokenType: TokenType, req: Request): boolean => {
	const expiry = verifiedClaims.exp;

	if (expiry && (Date.now() / 1000 >= expiry)) {
		throw new Error("JWT Verification Failed, token is expired");
	}

	if (verifiedClaims.qsh) {
		const qshVerified = validateQsh(tokenType, verifiedClaims.qsh, getJWTRequest(req));

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

export const checkGenericContainerActionUrl = (url: string): boolean | undefined => {
	const genericContainerActionUrls = getGenericContainerUrls();

	return genericContainerActionUrls.some(moduleUrl => {
		return matchRouteWithPattern(moduleUrl, url);
	});
};

const checkSecurityContainerActionUrl = (url: string) => {
	return getSecurityContainerActionUrls.some(moduleUrl => {
		return matchRouteWithPattern(moduleUrl, url);
	});
};
