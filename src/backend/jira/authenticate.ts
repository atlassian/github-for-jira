import {
	extractJwtFromRequest,
	TokenType,
	verifyAsymmetricJwtTokenMiddleware,
	verifySymmetricJwtTokenMiddleware,
} from "../../common/jwt";
import { NextFunction, Request, Response } from "express";
import { booleanFlag, BooleanFlags } from "../../config/feature-flags";
import { AsymmetricAlgorithm, getAlgorithm } from "atlassian-jwt";

export const authenticateJiraEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	verifySymmetricJwtTokenMiddleware(res.locals.installation.sharedSecret, TokenType.normal, req, res, next)
}

export const authenticateUninstallCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	if (await booleanFlag(BooleanFlags.USE_JWT_SIGNED_INSTALL_CALLBACKS, false)) {
		await verifyAsymmetricJwtTokenMiddleware(req, res, next);
	} else {
		const token = extractJwtFromRequest(req);
		if(!token) {
			res.sendStatus(401)
			return;
		}
		//When we migrate from symmetric to asymmetric tokens we can have a situation when part of the Jira instances use
		//old way to authenticate uninstall callback and other use the new way. So we need to determine which one to use from
		//the token algorithm
		if (getAlgorithm(token) == AsymmetricAlgorithm.RS256) {
			req.log.info("Asymmetric token detected. Using asymmetric algorithm")
			await verifyAsymmetricJwtTokenMiddleware(req, res, next);
		} else {
			req.log.info("Symmetric token detected. Using symmetric algorithm")
			verifySymmetricJwtTokenMiddleware(res.locals.installation.sharedSecret, TokenType.normal, req, res, next);
		}
	}
}


export const authenticateInstallCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	if (await booleanFlag(BooleanFlags.USE_JWT_SIGNED_INSTALL_CALLBACKS, false)) {
		await verifyAsymmetricJwtTokenMiddleware(req, res, next);
	} else {
		next();
	}
}

