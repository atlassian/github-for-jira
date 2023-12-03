import { NextFunction, Request, Response } from "express";
import { Installation } from "models/installation";
import { JiraClient } from "models/jira-client";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export const fetchAndSaveUserJiraAdminStatus = async (req: Request, claims: { sub?: string;}, installation: Installation): Promise<void> => {
	const ADMIN_PERMISSION = "ADMINISTER";
	// We only need to fetch this from Jira if it doesn't exist in the session
	if (req.session.isJiraAdmin !== undefined) {
		return;
	}

	try {
		const userAccountId = claims.sub;
		// Can't check permissions without userAccountId
		if (!userAccountId) {
			return;
		}
		const jiraClient = await JiraClient.getNewClient(installation, req.log);
		const permissions = await jiraClient.checkAdminPermissions(userAccountId);

		const data = permissions.data as { globalPermissions?: string[] };
		req.session.isJiraAdmin = data.globalPermissions?.includes(ADMIN_PERMISSION);
		req.log.info({ isAdmin :req.session.isJiraAdmin }, "Admin permissions set");
	} catch (err: unknown) {
		req.log.error({ err }, "Failed to fetch Jira Admin rights");
	}
};

export const jiraAdminPermissionsMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<Response | undefined>  => {
	if (!(await booleanFlag(BooleanFlags.JIRA_ADMIN_CHECK))) {
		next();
		return undefined;
	}
	const { isJiraAdmin } = req.session;

	if (isJiraAdmin === undefined) {
		// User permissions could bot be extracted from the Jira JWT, check that the jwt middleware has run
		req.log.info("No Jira user permissions found");
		return res.status(403).send("Forbidden - User Jira permissions have not been found.");
	}

	if (!isJiraAdmin) {
		req.log.info("User does not have Jira admin permissions.");
		return res.status(403).send("Forbidden - User does not have Jira administer permissions.");
	}
	next();
	return undefined;
};
