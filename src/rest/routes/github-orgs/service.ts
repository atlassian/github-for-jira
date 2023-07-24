import Logger from "bunyan";
import { createAppClient, createUserClient } from "utils/get-github-client-config";
import { Octokit } from "@octokit/rest";
import {
	getInstallationsWithAdmin,
	installationConnectedStatus
} from "routes/github/configuration/github-configuration-get";
import { Installation } from "models/installation";
import { AxiosResponse } from "axios";

const fetchGitHubOrganizations = async (
	githubToken: string,
	jiraHost: string,
	installation: Installation,
	log: Logger
): Promise<Array<Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem>> => {
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, { trigger: "getOrganizations" }, log, undefined);
	const { data: { login } } = await gitHubUserClient.getUser();

	/**
	 * TODO: This only works for the Github cloud flow,
	 * Get the value for `gitHubAppId` and `gitHubAppUuid` for Enterprise flow
 	 */
	try {
		const { data: { installations } } = await gitHubUserClient.getInstallations();
		const installationsWithAdmin = await getInstallationsWithAdmin(
			installation.id,
			gitHubUserClient,
			log,
			login,
			installations,
			jiraHost,
			undefined,
			undefined
		);

		log.debug(`Received user's installations with admin status from GitHub`);

		const connectedInstallations = await installationConnectedStatus(
			jiraHost,
			installationsWithAdmin,
			log,
			undefined
		);

		return connectedInstallations.filter(installation => !installation.syncStatus);
	} catch (e) {
		log.error(e, "Failed to fetch the organizations");
		return [];
	}
};


const searchGitHubOrganization = async (
	orgName: string,
	jiraHost: string,
	log: Logger
): Promise<AxiosResponse | null> => {
	try {
		const gitHubAppClient = await createAppClient(log, jiraHost, undefined, { trigger: "searchOrganization" });
		return await gitHubAppClient.searchOrg(orgName);
	} catch (e) {
		log.error(e, "Failed to search the organizations");
		return null;
	}
};

export { fetchGitHubOrganizations, searchGitHubOrganization };
