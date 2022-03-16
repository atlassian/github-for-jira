import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { getLogger } from "../../config/logger";
import { GitHubAppClient } from "../../github/client/github-app-client";

const logger = getLogger("services.github.user");
// TODO: Remove this method on featureFlag cleanup
export const getGithubUser = async (github: GitHubAPI | GitHubAppClient, username: string): Promise<Octokit.UsersGetByUsernameResponse | undefined> => {
	if (!username) {
		return undefined;
	}

	try {
		const response = github instanceof GitHubAppClient ?
			await github.getUserByUsername(username):
			await github.users.getByUsername({ username });
		return response.data;
	} catch (err) {
		logger.warn({ username }, "Cannot retrieve user from Github REST API");
	}
	return undefined;
};
