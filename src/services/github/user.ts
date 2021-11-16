import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { getLogger } from "../../config/logger";
import GitHubClient from "../../github/client/github-client";

const logger = getLogger("services.github.user")
// TODO: Remove this method on featureFlag cleanup
export const getGithubUser = async (github: GitHubAPI, username: string): Promise<Octokit.UsersGetByUsernameResponse | undefined> => {
	if (!username) {
		return undefined;
	}

	try {
		return (await github.users.getByUsername({ username })).data;
	} catch (err) {
		logger.warn({ username }, "Cannot retrieve user from Github REST API");
	}
	return undefined;
};

export const getGithubUserNew = async (github: GitHubClient, username: string): Promise<Octokit.UsersGetByUsernameResponse | undefined> => {
	if (!username) {
		return undefined;
	}

	try {
		return (await github.getUserByUsername(username)).data;
	} catch (err) {
		logger.warn({ username }, "Cannot retrieve user from Github REST API");
	}
	return undefined;
};