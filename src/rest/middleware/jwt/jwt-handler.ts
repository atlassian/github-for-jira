import { Request, Response, NextFunction } from "express";
import Logger from "bunyan";
import { decodeSymmetric, getAlgorithm, AsymmetricAlgorithm, SymmetricAlgorithm } from "atlassian-jwt";
import { Installation } from "models/installation";
import { errorWrapper } from "../../helper";
import { InvalidTokenError } from "config/errors";
import { BaseLocals } from "../../routes";

const INVALID_SECRET = "some-invalid-secret";
const SKIP_PATHS = ["/spa/deferred"];

export const JwtHandler = errorWrapper("JwtHandler", async (req: Request, res: Response<unknown, BaseLocals>, next: NextFunction) => {

	const token = req.headers["authorization"];

	if (!token) {
		throw new InvalidTokenError("Unauthorised");
	}

	try {
		const { installation, accountId } = await verifySymmetricJwt(token, req.log);
		res.locals.installation = installation;
		res.locals.jiraHost = installation.jiraHost;
		res.locals.accountId = accountId;
		next();

	} catch (e: unknown) {
		req.log.warn({ err: e }, "Failed to verify JWT token");
		throw new InvalidTokenError("Unauthorised");
	}

});

export const JwtHandlerWithoutQsh = errorWrapper("JwtHandlerWithoutQsh", async (req: Request, res: Response, next: NextFunction) => {
	const token = req.query.jwt?.toString();
	const path = req.originalUrl.split("?")[0];

	if (SKIP_PATHS.includes(path)) {
		next();
		return;
	}

	if (!token) {
		throw new InvalidTokenError("Unauthorised");
	}

	try {
		const { installation } = await verifySymmetricJwt(token, req.log, true);
		res.locals.jiraHost = installation.jiraHost;
		next();

	} catch (e: unknown) {
		req.log.warn({ err: e }, "Failed to verify JWT token");
		throw new InvalidTokenError("Unauthorised");
	}
});

const verifySymmetricJwt = async (token: string, logger: Logger, ignoreQsh: boolean = false) => {
	const algorithm = getAlgorithm(token) as AsymmetricAlgorithm | SymmetricAlgorithm;

	// Decode without verification;
	const unverifiedClaims = decodeSymmetric(token, INVALID_SECRET, algorithm, true) as { iss?: string };
	if (!unverifiedClaims.iss) {
		throw new Error("JWT claim did not contain the issuer (iss) claim");
	}

	const issuer = unverifiedClaims.iss;
	const installation = await Installation.getForClientKey(issuer);
	if (!installation) {
		throw new Error("No Installation found");
	}

	const secret = await installation.decrypt("encryptedSharedSecret", logger);

	//decode and verify
	const claims = decodeSymmetric(token, secret, algorithm, false) as { sub?: string, exp?: number, qsh?: string };

	const expiry = claims.exp;

	if (expiry && (Date.now() / 1000 >= expiry)) {
		throw new Error("JWT Verification Failed, token is expired");
	}

	if (!ignoreQsh && claims.qsh !== "context-qsh") {
		throw new Error("JWT Verification Failed, wrong qsh");
	}

	return { installation, accountId: claims.sub };
};
