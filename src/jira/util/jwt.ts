// Original source code:
// https://bitbucket.org/atlassian/atlassian-connect-express/src/f434e5a9379a41213acf53b9c2689ce5eec55e21/lib/middleware/authentication.js?at=master&fileviewer=file-view-default#authentication.js-227
// TODO: need some typing for jwt
import jwt from "atlassian-jwt";
import {Request, Response} from "express";
import envVars from "../../config/env";

const JWT_PARAM = "jwt";
const AUTH_HEADER = "authorization"; // the header name appears as lower-case
const BASE_URL = envVars.APP_URL

/**
 * Atlassian Connect has 2 different types of JWT tokens.
 * Normal tokens has qsh parameter and generated by Jira for backend authentication (like installation webhooks)
 * or web elements like iFrame
 *
 * Context tokens are tokens which are generated by App iframes for the authentication with app backend.
 * They don't require sqh verification and their qsh is set to a fixed `context-qsh` value.
 *
 * When building endpoints we should specify which type of tokens they require
 *
 * See details at: https://community.developer.atlassian.com/t/action-required-atlassian-connect-vulnerability-allows-bypass-of-app-qsh-verification-via-context-jwts/47072
 */
export enum TokenType {
	normal = "normal",
	context = "context"
}

function extractJwtFromRequest(req) {
	const tokenInQuery = req.query ? req.query[JWT_PARAM] : undefined;

	// JWT appears in both parameter and body will result query hash being invalid.
	const tokenInBody = req.body ? req.body[JWT_PARAM] : undefined;
	if (tokenInQuery && tokenInBody) {
		req.log("JWT token can only appear in either query parameter or request body.");
		return;
	}
	let token = tokenInQuery || tokenInBody;

	// if there was no token in the query-string then fall back to checking the Authorization header
	const authHeader = req.headers ? req.headers[AUTH_HEADER] : undefined;
	if (authHeader?.startsWith("JWT ")) {
		if (token) {
			const foundIn = tokenInQuery ? "query" : "request body";
			req.log.info(`JWT token found in ${foundIn} and in header: using ${foundIn} value.`);
		} else {
			token = authHeader.substring(4);
		}
	}

	// JWT is missing in query and we don't have a valid body.
	if (!token) {
		req.log.info("JWT token is missing in the request");
		return;
	}

	return token;
}

function sendError(res, code, msg) {
	res.status(code).json({
		message: msg
	});
}

function verifyQsh(qsh: string, req: Request) {
	let expectedHash = jwt.createQueryStringHash(req, false, BASE_URL);
	let signatureHashVerified = qsh === expectedHash;
	if (!signatureHashVerified) {
		jwt.createCanonicalRequest(req, false, BASE_URL); // eslint-disable-line

		// If that didn't verify, it might be a post/put - check the request body too
		expectedHash = jwt.createQueryStringHash(req, true, BASE_URL);
		signatureHashVerified = qsh === expectedHash;
		if (!signatureHashVerified) {
			return false;
		}
	}
	return true
}

export const hasValidJwt = (secret: string, req: Request, res: Response, tokenType: TokenType) => {
	const token = extractJwtFromRequest(req);
	if (!token) {
		sendError(res, 401, "Could not find authentication data on request");
		return false;
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let unverifiedClaims: any;
	try {
		unverifiedClaims = jwt.decode(token, "", true); // decode without verification;
	} catch (e) {
		sendError(res, 401, `Invalid JWT: ${e.message}`);
		return false;
	}

	const issuer = unverifiedClaims.iss;
	if (!issuer) {
		sendError(res, 401, "JWT claim did not contain the issuer (iss) claim");
		return false;
	}

	let verifiedClaims;
	try {
		verifiedClaims = jwt.decode(token, secret, false);
	} catch (error) {
		sendError(res, 400, `Unable to decode JWT token: ${error}`);
		return false;
	}

	const expiry = verifiedClaims.exp;

	// TODO: build in leeway?
	if (expiry && (Date.now() / 1000 >= expiry)) {
		sendError(res, 401, "Authentication request has expired. Try reloading the page.");
		return false;
	}

	if (verifiedClaims.qsh) {
		let qshVerified = false
		if (tokenType === TokenType.context) {
			//If we use context jsw tokens, their qsh will be constant
			qshVerified = verifiedClaims.qsh === "context-qsh"
		} else {
			//validate query string hash
			qshVerified = verifyQsh(verifiedClaims.qsh, req);
		}

		if (!qshVerified) {
			sendError(res, 401, "Invalid jwt token");
		}
		return qshVerified

	} else {
		sendError(res, 401, "JWT tokens without qsh are not allowed");
		return false
	}
};
