import { NextFunction, Request, Response } from "express";
import { JiraClient } from "models/jira-client";
import { InsufficientPermissionError, InvalidTokenError } from "config/errors";
import { errorWrapper } from "../../helper";
import { BaseLocals } from "../../routes";

const ADMIN_PERMISSION = "ADMINISTER";
export const JiraAdminEnforceMiddleware = errorWrapper("jiraAdminEnforceMiddleware", async (req: Request, res: Response<any, BaseLocals>, next: NextFunction): Promise<void>  => {

	const { accountId, installation } = res.locals;

	if (!accountId) {
		throw new InvalidTokenError("Missing userAccountId");
	}

	const jiraClient = await JiraClient.getNewClient(installation, req.log);

	const permissions = await jiraClient.checkAdminPermissions(accountId) as { data?: { globalPermissions?: string[] } };

	const isAdmin = permissions.data?.globalPermissions?.includes(ADMIN_PERMISSION);
	if (!isAdmin) {
		throw new InsufficientPermissionError("Forbidden - User does not have Jira administer permissions.");
	}

	req.log.debug({ isAdmin }, "Admin permissions checked");
	next();
});
