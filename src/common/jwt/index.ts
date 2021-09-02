// Original source code:
// https://bitbucket.org/atlassian/atlassian-connect-express/src/f434e5a9379a41213acf53b9c2689ce5eec55e21/lib/middleware/authentication.js?at=master&fileviewer=file-view-default#authentication.js-227
// TODO: need some typing for jwt
import {createQueryStringHash, decodeAsymmetric, decodeSymmetric, getAlgorithm, getKeyId} from "atlassian-jwt";
import {NextFunction, Request, Response} from "express";
import envVars from "../../config/env";
import _ from "lodash";
import queryAtlassianConnectPublicKey from "../queryAtlassianConnectPublicKey";

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

export function extractJwtFromRequest(req: Request): string | void {
	const tokenInQuery = req.query?.[JWT_PARAM];

	// JWT appears in both parameter and body will result query hash being invalid.
	const tokenInBody = req.body?.[JWT_PARAM];
	if (tokenInQuery && tokenInBody) {
		req.log.info("JWT token can only appear in either query parameter or request body.");
		return;
	}
	let token = tokenInQuery || tokenInBody;

	// if there was no token in the query-string then fall back to checking the Authorization header
	const authHeader = req.headers?.[AUTH_HEADER];
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

function sendError(res: Response, code: number, msg: string): void {
	res.status(code).json({
		message: msg
	});
}

function decodeAsymmetricToken(token: string, publicKey: string, noVerify: boolean): any {
	return decodeAsymmetric(
		token,
		publicKey,
		getAlgorithm(token),
		noVerify
	);
}


function verifyQsh(qsh: string, req: Request): boolean {
	const requestInAtlassianJwtFormat = {...req, pathname: req.path}
	let expectedHash = createQueryStringHash(requestInAtlassianJwtFormat, false, BASE_URL);
	let signatureHashVerified = qsh === expectedHash;

	if (!signatureHashVerified) {
		// If that didn't verify, it might be a post/put - check the request body too
		expectedHash = createQueryStringHash(requestInAtlassianJwtFormat, true, BASE_URL);
		signatureHashVerified = qsh === expectedHash;
		if (!signatureHashVerified) {
			return false;
		}
	}
	return true
}

export function verifyJwtClaimsAndSetResponseCodeOnError(verifiedClaims, tokenType: TokenType, req: Request, res: Response): boolean {
	const expiry = verifiedClaims.exp;

	// TODO: build in leeway?
	if (expiry && (Date.now() / 1000 >= expiry)) {
		req.log.info("JWT Verification Failed, token is expired")
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
			req.log.info("JWT Verification Failed, wrong qsh")
			sendError(res, 401, "Unauthorized");
		}
		return qshVerified

	} else {
		req.log.info("JWT Verification Failed, no qsh")
		sendError(res, 401, "JWT tokens without qsh are not allowed");
		return false
	}
}

const verifySymmetricJwtAndSetResponseCodeOnError = (secret: string, req: Request, res: Response, tokenType: TokenType): boolean => {
	const token = extractJwtFromRequest(req);
	if (!token) {
		sendError(res, 401, "Could not find authentication data on request");
		return false;
	}

	const algorithm = getAlgorithm(token)

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let unverifiedClaims: any;
	try {
		unverifiedClaims = decodeSymmetric(token, "", algorithm, true); // decode without verification;
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
		verifiedClaims = decodeSymmetric(token, secret, algorithm, false);
	} catch (error) {
		sendError(res, 400, `Unable to decode JWT token: ${error}`);
		return false;
	}

	return verifyJwtClaimsAndSetResponseCodeOnError(verifiedClaims, tokenType, req, res);
};

/**
 * Middleware function which verifies JWT token signed by symmetric shared key
 *
 * @param secret Shared key
 * @param tokenType Type of the token normal or context. Context tokens have different qsh verification behaviour
 * @param req Request
 * @param res Response
 * @param next Next function
 */
export const verifySymmetricJwtTokenMiddleware = (secret: string, tokenType: TokenType, req: Request, res: Response, next: NextFunction): void => {
	try {
		if (!verifySymmetricJwtAndSetResponseCodeOnError(secret, req, res, tokenType)) {
			return
		}
		req.log.info("JWT Token Verified Successfully!")
		next();
	} catch (error) {
		req.log.error(error, "Error happened when validating JWT token")
		sendError(res, 401, "Unauthorized")
		return
	}
}

const ALLOWED_BASE_URLS = [BASE_URL]

export const verifyAsymmetricJwtTokenMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		const token = extractJwtFromRequest(req);
		if (!token) {
			req.log.info("JWT Verification Failed, no token present")
			sendError(res, 401, "Unauthorized")
			return;
		}

		const publicKey = await queryAtlassianConnectPublicKey(getKeyId(token));

		let unverifiedClaims: any = undefined
		unverifiedClaims = decodeAsymmetricToken(token, publicKey, true)

		const issuer = unverifiedClaims.iss;
		if (!issuer) {
			req.log.info("JWT Verification Failed, no issuer present")
			sendError(res, 401, "JWT claim did not contain the issuer (iss) claim");
			return;
		}

		if (_.isEmpty(unverifiedClaims.aud) ||
			!unverifiedClaims.aud[0] ||
			!_.includes(ALLOWED_BASE_URLS, unverifiedClaims.aud[0].replace(/\/$/, ""))) {
			req.log.info("JWT Verification Failed, no correct audience present")
			sendError(res, 401, "WT claim did not contain the correct audience (aud) claim")
			return;
		}

		const verifiedClaims = decodeAsymmetricToken(token, publicKey, false)

		if (verifyJwtClaimsAndSetResponseCodeOnError(verifiedClaims, TokenType.normal, req, res)) {
			req.log.info("JWT Token Verified Successfully!")
			next()
		}
	} catch (e) {
		req.log.warn({...e}, "Error while validating JWT token")
		sendError(res, 401, "Unauthorized")
	}
}

