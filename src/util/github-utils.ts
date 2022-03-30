import { getLogger } from "config/logger";
import { GitHubUserClient } from "~/src/github/client/github-user-client";

const logger = getLogger("github-utils");
export const isUserAdminOfOrganization = async (githubClient: GitHubUserClient, org: string, username: string, orgType: string): Promise<boolean> => {

	// If this is a user installation, the "admin" is the user that owns the repo
	if (orgType === "User") {
		return org === username;
	}

	// Otherwise this is an Organization installation and we need to ask GitHub for role of the logged in user
	try {
		const { data: { role } } = await githubClient.getMembershipForOrg(org);
		logger.info(`isUserAdminOfOrganization: User ${username} has ${role} role for org ${org}`);
		return role === "admin";
	} catch (err) {
		logger.warn({ err, org, username }, `could not determine admin status of user ${username} in org ${org}`);
		throw err;
	}
};
