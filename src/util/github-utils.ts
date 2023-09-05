import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import Logger from "bunyan";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export const isUserAdminOfOrganization = async (githubClient: GitHubUserClient, jiraHost: string, gitHubAppClient: GitHubAppClient, orgName: string, username: string, orgType: string, logger: Logger): Promise<boolean> => {
	if (orgType === "User") {
		logger.info("isUserAdminOfOrganization: orgType is a user");
		return orgName === username;
	}

	try {
		if (await booleanFlag(BooleanFlags.USE_APP_CLIENT_CHECK_PERMISSION, jiraHost)) {
			logger.info("isUserAdminOfOrganization: orgType is an org, checking membership (app client)");
			const { data: { role } } = await gitHubAppClient.getUserMembershipForOrg(username, orgName);
			logger.info({ orgName, username, role }, `isUserAdminOfOrganization: User has role for org`);
			return role === "admin";
		}
	} catch (e) {
		logger.error({ err: e }, "Fail checking permission using GitHub App Client, fallback to user client");
	}

	try {
		logger.info("isUserAdminOfOrganization: orgType is an org, checking membership");
		const { data: { role } } = await githubClient.getMembershipForOrg(orgName);
		logger.info({ orgName, username }, `isUserAdminOfOrganization: User has ${role} role for org`);
		return role === "admin";
	} catch (err) {
		logger.warn({ err, orgName, username }, `could not determine admin status of user in org`);
		throw err;
	}
};
