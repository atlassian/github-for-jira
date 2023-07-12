import Logger from "bunyan";
import { createUserClient } from "utils/get-github-client-config";
import { Octokit } from "@octokit/rest";

const fetchGitHubOrganizations = async (
	githubToken: string,
	jiraHost: string,
	log: Logger
): Promise<Array<Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem>> => {
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, { trigger: "getOrganizations" }, log, undefined);

	try {
		const { data: { installations } } = await gitHubUserClient.getInstallations();
		/**
		 * TODO: Check the admin privilege for each organization,
		 * then add the connected status for the installations,
		 * followed by a sort
		 */

		return installations;
	} catch (e) {
		log.error(e, "Failed to fetch the organizations");
		return [];
	}
};

export default fetchGitHubOrganizations;
