import { GitHubUserClient } from "~/src/github/client/github-user-client";
import Logger from "bunyan";

export const isUserAdminOfOrganization = async (githubClient: GitHubUserClient, orgName: string, username: string, orgType: string, logger: Logger): Promise<boolean> => {
	if (orgType === "User") {
		logger.info("isUserAdminOfOrganization: orgType is a user");
		return orgName === username;
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
