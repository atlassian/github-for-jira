import { NextFunction } from "express";
import Logger from "bunyan";
import { createUserClient } from "utils/get-github-client-config";
import {
	getInstallationsWithAdmin,
	installationConnectedStatus
} from "routes/github/configuration/github-configuration-get";
import { Installation } from "models/installation";
import { GitHubInstallationType } from "rest-interfaces/oauth-types";

const fetchGitHubOrganizations = async (
	githubToken: string,
	jiraHost: string,
	installation: Installation,
	log: Logger,
	next: NextFunction
): Promise<Array<GitHubInstallationType> | void> => {
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

		return  connectedInstallations.filter(installation => !installation.syncStatus);
	} catch (e) {
		log.error(e, "Failed to fetch the organizations");
		next(e);
	}
};

export default fetchGitHubOrganizations;
