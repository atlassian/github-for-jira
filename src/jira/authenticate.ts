import {TokenType, verifyAsymmetricJwtTokenMiddleware, verifySymmetricJwtTokenMiddleware} from "./util/jwt";
import {NextFunction, Request, Response} from "express";
import {booleanFlag, BooleanFlags} from "../config/feature-flags";

const authenticateJiraEventMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction,
	asymmetric: boolean
): Promise<void> => {

	if( asymmetric ) {
		await verifyAsymmetricJwtTokenMiddleware(req, res, next);
	} else {
		verifySymmetricJwtTokenMiddleware(res.locals.installation.sharedSecret, TokenType.normal, req, res, next)
	}

};

export const authenticateJiraEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	await authenticateJiraEventMiddleware(req, res, next, false)
}

export const authenticateUninstallCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	if (await booleanFlag(BooleanFlags.USE_JWT_SIGNED_INSTALL_CALLBACKS, false) ) {
		await authenticateJiraEventMiddleware(req, res, next, true)
	} else {
		await authenticateJiraEventMiddleware(req, res, next, false)
	}
}


export const authenticateInstallCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	if (await booleanFlag(BooleanFlags.USE_JWT_SIGNED_INSTALL_CALLBACKS, false) ) {
		await authenticateJiraEventMiddleware(req, res, next, true)
	} else {
		next();
	}
}
