import {
	TokenType,
	verifySymmetricJwtTokenMiddleware
} from "./util/jwt";
import {NextFunction, Request, Response} from "express";

export const authenticateJiraEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	verifySymmetricJwtTokenMiddleware(res.locals.installation.sharedSecret, TokenType.normal, req, res, next)
}
