import { decodeSymmetric, getAlgorithm } from "atlassian-jwt";
import Logger from "bunyan";
import { NextFunction, Request, Response } from "express";
import { getJWTRequest, TokenType, validateQsh } from "~/src/jira/util/jwt";
import { Installation } from "~/src/models/installation";
import { moduleUrls } from "~/src/routes/jira/atlassian-connect/jira-atlassian-connect-get";
import { matchRouteWithPattern } from "~/src/util/match-route-with-pattern";
import { JiraClient } from "models/jira-client";

export const setJiraAdminPrivileges = async (req: Request, claims: Record<any, any>, installation: Installation) => {
	const ADMIN_PERMISSION = "ADMINISTER";
	// We only need to add this to the session if it doesn't exist
	if (req.session.isJiraAdmin !== undefined) {
		return;
	}

	try {
		const userAccountId = claims.sub;
		// Can't check permissions without userAccountId
		if (!userAccountId) {
			return;
		}
		const jiraClient = await JiraClient.getNewClient(installation, req.log);
		// Make jira call to permissions with userAccountId.
		const permissions = await jiraClient.checkAdminPermissions(userAccountId);
		const hasAdminPermissions = permissions.data.globalPermissions.includes(ADMIN_PERMISSION);

		req.session.isJiraAdmin = hasAdminPermissions;
		req.log.info({ isAdmin :req.session.isJiraAdmin }, "Admin permissions set");
	} catch (err) {
		req.log.error({ err }, "Failed to fetch Jira Admin rights");
	}
};

export const jiraSymmetricJwtMiddleware = async (req: Request, res: Response, next: NextFunction) => {

	const token = req.query?.["jwt"] || req.cookies?.["jwt"] || req.body?.["jwt"];

	if (token) {

		let issuer;
		try {
			issuer = getIssuer(token, req.log);
		} catch (err) {
			req.log.warn({ err }, "Could not get issuer");
			return res.status(401).send("Unauthorised");
		}

		const installation = await Installation.getForClientKey(issuer);
		if (!installation) {
			req.log.warn("No Installation found");
			return res.status(401).send("Unauthorised");
		}

		let verifiedClaims;
		try {
			verifiedClaims = await verifySymmetricJwt(req, token, installation);
		} catch (err) {
			req.log.warn({ err }, "Could not verify symmetric JWT");
			return res.status(401).send("Unauthorised");
		}
		res.locals.installation = installation;
		res.locals.jiraHost = installation.jiraHost;
		req.session.jiraHost = installation.jiraHost;

		// Check whether logged in user has Jira Admin permissions and save it to the session
		await setJiraAdminPrivileges(req, verifiedClaims, installation);

		if (req.cookies.jwt) {
			res.clearCookie("jwt");
		}
		req.addLogFields({ jiraHost: res.locals.jiraHost });
		return next();

	} else if (req.session?.jiraHost) {

		const installation = await Installation.getForHost(req.session.jiraHost);
		if (!installation) {
			req.log.warn("No Installation found");
			req.session.jiraHost = undefined;
			return res.status(401).send("Unauthorised");
		}

		res.locals.installation = installation;
		res.locals.jiraHost = installation.jiraHost;
		req.addLogFields({ jiraHost: res.locals.jiraHost });
		return next();
	}

	req.log.warn("No token found and session cookie has not jiraHost");
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

	if (!unverifiedClaims.iss) {
		throw new Error("JWT claim did not contain the issuer (iss) claim");
	}

	return unverifiedClaims.iss;
};

const verifySymmetricJwt = async (req: Request, token: string, installation: Installation) => {
	const algorithm = getAlgorithm(token);
	const secret = await installation.decrypt("encryptedSharedSecret", req.log);

	try {
		const claims = decodeSymmetric(token, secret, algorithm, false);
		const tokenType = checkPathValidity(req.originalUrl) && req.method == "GET" ? TokenType.normal : TokenType.context;
		verifyJwtClaims(claims, tokenType, req);
		return claims;
	} catch (err) {
		req.log.warn({ err }, "Invalid JWT");
		throw new Error(`Unable to decode JWT token: ${err.message}`);
	}
};

export const verifyJwtClaims = (verifiedClaims: { exp: number, qsh: string }, tokenType: TokenType, req: Request): boolean => {
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
