import { Octokit } from "@octokit/rest";
import { GitHubInstallationClient } from "../../github/client/github-installation-client";
import Logger from "bunyan";

// TODO: Remove this method on featureFlag cleanup
export const getGithubUser = async (gitHubInstallationClient: GitHubInstallationClient, username: string, logger: Logger): Promise<Octokit.UsersGetByUsernameResponse | undefined> => {
	if (!username) {
		return undefined;
	}

	try {
		const response =  await gitHubInstallationClient.getUserByUsername(username);
		return response.data;
	} catch (err: unknown) {
		logger.warn({ err, username }, "Cannot retrieve user from Github REST API");
	}
	return undefined;
};
