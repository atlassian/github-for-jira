import {
	TokenType,
	verifyAsymmetricJwtTokenMiddleware,
	verifySymmetricJwtTokenMiddleware,
} from "../../common/jwt";
import { NextFunction, Request, Response } from "express";
import { booleanFlag, BooleanFlags } from "../../config/feature-flags";

export const authenticateJiraEvent = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	verifySymmetricJwtTokenMiddleware(
		res.locals.installation.sharedSecret,
		TokenType.normal,
		req,
		res,
		next
	);
};

export const authenticateUninstallCallback = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	if (await booleanFlag(BooleanFlags.USE_JWT_SIGNED_INSTALL_CALLBACKS, false)) {
		await verifyAsymmetricJwtTokenMiddleware(req, res, next);
	} else {
		verifySymmetricJwtTokenMiddleware(
			res.locals.installation.sharedSecret,
			TokenType.normal,
			req,
			res,
			next
		);
	}
};

export const authenticateInstallCallback = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	if (await booleanFlag(BooleanFlags.USE_JWT_SIGNED_INSTALL_CALLBACKS, false)) {
		await verifyAsymmetricJwtTokenMiddleware(req, res, next);
	} else {
		next();
	}
};
