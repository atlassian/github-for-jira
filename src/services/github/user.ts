import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "../../github/client/github-installation-client";

const logger = getLogger("services.github.user");
// TODO: Remove this method on featureFlag cleanup
export const getGithubUser = async (github: GitHubAPI | GitHubInstallationClient, username: string): Promise<Octokit.UsersGetByUsernameResponse | undefined> => {
	if (!username) {
		return undefined;
	}

	try {
		const response = github instanceof GitHubInstallationClient ?
			await github.getUserByUsername(username) :
			await github.users.getByUsername({ username });
		return response.data;
	} catch (err) {
		logger.warn({ username }, "Cannot retrieve user from Github REST API");
	}
	return undefined;
};
