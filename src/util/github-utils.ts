import { getLogger } from "config/logger";
import { GitHubUserClient } from "~/src/github/client/github-user-client";

const logger = getLogger("github-utils");
export const isUserAdminOfOrganization = async (githubClient: GitHubUserClient, orgName: string, username: string, orgType: string): Promise<boolean> => {

	// If this is a user installation, the "admin" is the user that owns the repo
	if (orgType === "User") {
		return orgName === username;
	}

	// Otherwise this is an Organization installation and we need to ask GitHub for role of the logged in user
	try {
		const { data: { role } } = await githubClient.getMembershipForOrg(orgName);
		logger.info({ orgName, username }, `isUserAdminOfOrganization: User has ${role} role for org`);
		return role === "admin";
	} catch (err) {
		logger.warn({ err, orgName, username }, `could not determine admin status of user in org`);
		throw err;
	}
};
