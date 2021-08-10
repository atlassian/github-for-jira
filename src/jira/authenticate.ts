import {Installation} from "../models";
import {verifySymmetricJwtTokenMiddleware, TokenType, verifyAsymmetricJwtTokenMiddleware} from "./util/jwt";
import {NextFunction, Request, Response} from "express";

const instrumentRequestAndAuthenticateJiraEvent = async (
	req: Request,
	res: Response,
	next: NextFunction,
	asymmetric: boolean
): Promise<void> => {
	const installation = await Installation.getForClientKey(req.body.clientKey);
	if (!installation) {
		res.status(404).json({});
		return;
	}

	const { jiraHost, sharedSecret, clientKey } = installation;

	req.addLogFields({
		jiraHost,
		jiraClientKey: `${clientKey.substr(0, 5)}***}`
	});
	res.locals.installation = installation;

	if( asymmetric ) {
		await verifyAsymmetricJwtTokenMiddleware(req, res, next);
	} else {
		verifySymmetricJwtTokenMiddleware(sharedSecret, TokenType.normal, req, res, next)
	}

};

export const authenticateJiraEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	await instrumentRequestAndAuthenticateJiraEvent(req, res, next, false)
}

export const authenticateUninstallCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	//TODO Add feature flags
	//if ( enable-signed-install-for-jira ) {

	await instrumentRequestAndAuthenticateJiraEvent(req, res, next, true)

	// } else {
	// instrumentRequestAndAuthenticateJiraEvent(req, res, next, false)
	// }

}


export const authenticateInstallCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	//TODO Add feature flags
	//if ( enable-signed-install-for-jira ) {

	await instrumentRequestAndAuthenticateJiraEvent(req, res, next, true)

	// } else {
	// next();
	// }
}
