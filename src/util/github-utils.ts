import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import Logger from "bunyan";

export const isUserAdminOfOrganization = async (githubUserClient: GitHubUserClient, gitHubInstallationClient: GitHubInstallationClient, orgName: string, username: string, orgType: string, logger: Logger): Promise<boolean> => {
	if (orgType === "User") {
		logger.info("isUserAdminOfOrganization: orgType is a user");
		return orgName === username;
	}

	try {
		logger.info("isUserAdminOfOrganization: orgType is an org, checking membership (app client)");
		const { data: { state, role } } = await gitHubInstallationClient.getUserMembershipForOrg(username, orgName);
		logger.info({ orgName, username, state, role }, `isUserAdminOfOrganization: User has role for org`);
		return role === "admin" && state === "active";
	} catch (err: unknown) {
		logger.warn({ err }, "Fail checking permission using GitHub App Client, fallback to user client");
	}

	try {
		logger.info("isUserAdminOfOrganization: orgType is an org, checking membership (user client)");
		const { data: { role } } = await githubUserClient.getMembershipForOrg(orgName);
		logger.info({ orgName, username }, `isUserAdminOfOrganization: User has ${role} role for org`);
		return role === "admin";
	} catch (err: unknown) {
		logger.warn({ err, orgName, username }, `could not determine admin status of user in org`);
		throw err;
	}
};
