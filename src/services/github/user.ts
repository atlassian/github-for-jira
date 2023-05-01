import { Octokit } from "@octokit/rest";
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "../../github/client/github-installation-client";

const logger = getLogger("services.github.user");

export const getGithubUser = async (gitHubInstallationClient: GitHubInstallationClient, username: string): Promise<Octokit.UsersGetByUsernameResponse | undefined> => {
	if (!username) {
		return undefined;
	}

	try {
		const response =  await gitHubInstallationClient.getUserByUsername(username);
		return response.data;
	} catch (err) {
		logger.warn({ err, username }, "Cannot retrieve user from Github REST API");
	}
	return undefined;
};
