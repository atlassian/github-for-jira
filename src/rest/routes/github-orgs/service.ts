import Logger from "bunyan";
import { createAppClient, createInstallationClient, createUserClient } from "utils/get-github-client-config";
import {
	getInstallationsWithAdmin,
	installationConnectedStatus
} from "routes/github/configuration/github-configuration-get";
import { Installation } from "models/installation";
import {
	CheckOrgOwnershipResponse,
	GitHubInstallationType
} from "rest-interfaces";
import { isUserAdminOfOrganization } from "utils/github-utils";

export const fetchGitHubOrganizations = async (
	githubToken: string,
	jiraHost: string,
	installation: Installation,
	log: Logger
): Promise<Array<GitHubInstallationType> | void> => {
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, { trigger: "getOrganizations" }, log, undefined);
	const { data: { login } } = await gitHubUserClient.getUser();

	/**
	 * TODO: This only works for the Github cloud flow,
	 * Get the value for `gitHubAppId` and `gitHubAppUuid` for Enterprise flow
 	 */
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
};

export const checkGitHubOrgOwnership = async (githubToken: string, jiraHost: string, githubInstallationId: number, logger: Logger): Promise<CheckOrgOwnershipResponse> => {
	const metrics = {
		trigger: "check-github-ownership"
	};
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, metrics, logger, undefined);
	const gitHubAppClient = await createAppClient(logger, jiraHost, undefined, metrics);

	logger.info("Fetching info about user");
	const { data: { login } } = await gitHubUserClient.getUser();

	logger.info("Fetching info about installation");
	const { data: installation } = await gitHubAppClient.getInstallation(githubInstallationId);
	const gitHubInstallationClient = await createInstallationClient(githubInstallationId, jiraHost, { trigger: "hasAdminAccess" }, logger, undefined);
	const hasAdminAccess = await isUserAdminOfOrganization(gitHubUserClient, jiraHost, gitHubInstallationClient, installation.account.login, login, installation.target_type, logger);

	return {
		isAdmin: hasAdminAccess,
		orgName: installation.account.login
	};
};
