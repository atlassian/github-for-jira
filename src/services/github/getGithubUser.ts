import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { getLogger } from "../../config/logger";

const logger = getLogger("services.github.getGithubUser")

export const getGithubUser = async (github:GitHubAPI, username:string):Promise<Octokit.UsersGetByUsernameResponse> => {
	if(!username) {
		return undefined;
	}

	try {
		return (await github.users.getByUsername({ username })).data;
	} catch (err) {
		logger.warn({username}, "Cannot retrieve user from Github REST API");
	}
	return undefined;
}
