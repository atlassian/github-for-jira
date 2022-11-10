import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";

type ResponseType =  Response<
	{
		success: true,
	} | {
		success: false,
		message: string
	},
	& JiraJwtVerifiedLocals
>;
export const JiraConnectEnterpriseDelete = async (
	req: Request,
	res: ResponseType,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise Server DELETE request");

		const { installation }  = res.locals;

		await GitHubServerApp.uninstallServer(req.body.serverUrl, installation.id);

		res.status(200).send({ success: true });
		req.log.debug("Jira Connect Enterprise Server successfully deleted.");
	} catch (error) {
		res.status(200).send({ success: false, message: "Failed to delete GitHub Enterprise Server." });
		return next(new Error(`Failed to DELETE GitHub Enterprise Server: ${error}`));
	}
};
