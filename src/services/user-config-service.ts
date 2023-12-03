import Logger from "bunyan";
import { RepoSyncState } from "models/reposyncstate";
import { Config } from "interfaces/common";
import YAML from "yaml";
import { Subscription } from "models/subscription";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";

const USER_CONFIG_FILE = ".jira/config.yml";
const MAX_PATTERNS_PER_ENVIRONMENT = 10;
const MAX_SERVICE_ID_COUNT = 100;

/**
 * Checks whether a list of modified files contains the config file. If yes, reads that config file
 * from the GitHub repository, parses it, and stores the config against the given repository
 * in the database.
 *
 * This function is meant to be called whenever there is a change in the repository so we can check
 * if the config file has changed.
 *
 * The `modifiedFiles` in the args, is a list of modified files (added, modified, or removed). The config will only be updated if this list contains
 * the config file.
 */
export const updateRepoConfig = async (
	subscription: Subscription,
	repositoryId: number,
	gitHubInstallationClient: GitHubInstallationClient,
	logger: Logger,
	modifiedFiles: string[] = []
): Promise<void> => {
	if (modifiedFiles.includes(USER_CONFIG_FILE)) {
		try {

			logger.info("Found modifiedFiles include .jira/config.yml, proceed to update user config");

			const repoSyncState = await RepoSyncState.findByRepoId(subscription, repositoryId);

			if (!repoSyncState) {
				logger.error({
					gitHubInstallationId: gitHubInstallationClient.githubInstallationId,
					repositoryId
				}, "could not find RepoSyncState for repo");
				return;
			}

			await updateRepoConfigsFromGitHub([repoSyncState], gitHubInstallationClient, logger);
		} catch (err: unknown) {
			logger.error({
				err,
				gitHubInstallationId: gitHubInstallationClient.githubInstallationId,
				repositoryId
			}, "error while updating the repo config");
		}
	}
};

/**
 * Returns the config for a given repo.
 */
export const getRepoConfig = async (
	subscription: Subscription,
	gitHubInstallationClient: GitHubInstallationClient,
	repositoryId: number,
	repoOwner: string,
	repoName: string,
	logger: Logger
): Promise<Config | undefined> => {
	// In the future, we may look in other places for a config than just in the RepoSyncState (for example,
	// we might fall back to default configs on the level of a subscription or an installation).
	const repoSyncState = await RepoSyncState.findByRepoId(subscription, repositoryId);

	// Edge case: we don't have a record of the repository in our DB, yet, so we're loading the
	// config directly from the config file in the GitHub repo.
	if (!repoSyncState) {
		const yamlConfig = await getRepoConfigFromGitHub(gitHubInstallationClient, repoOwner, repoName);
		return convertYamlToUserConfig(yamlConfig, logger);
	}

	// Standard case: we return the config from our database.
	return repoSyncState.config;
};

/**
 * Fetches contents from CONFIG_PATH from GitHub via GitHub's API, transforms it from base64 to ascii and returns the transformed string.
 */
const getRepoConfigFromGitHub = async (gitHubInstallationClient: GitHubInstallationClient, owner: string, repo: string): Promise<string | undefined> => {
	const contents = await gitHubInstallationClient.getRepositoryFile(owner, repo, USER_CONFIG_FILE);

	if (!contents) {
		return undefined;
	}
	return Buffer.from(contents, "base64").toString("utf-8");
};

/**
 * Iterates through environment patterns and returns true if any environment contains too many patterns to test against.
 */
const hasTooManyPatternsPerEnvironment = (config: Config | undefined): boolean => {
	const environmentMapping = config?.deployments?.environmentMapping;
	if (!environmentMapping) {
		return false;
	}
	return Object.keys(environmentMapping).some(key => {
		return (environmentMapping[key]?.length || 0) > MAX_PATTERNS_PER_ENVIRONMENT;
	});
};

/**
 * Converts incoming YAML string to JSON (RepoConfig)
 */
const convertYamlToUserConfig = (input: string | undefined, logger: Logger): Config => {

	if (!input) {
		return {};
	}

	const config = YAML.parse(input) as Config | undefined;
	logger.info("User config file yaml content parsed successfully");

	const configDeployments = config?.deployments;
	const deployments = {};
	if (configDeployments != null) {
		if (configDeployments.environmentMapping) {
			deployments["environmentMapping"] = configDeployments.environmentMapping;
			logger.info("Found deployments mappings in user config files");
		}
		if (configDeployments.services?.ids) {
			deployments["services"] = {
				ids: configDeployments.services.ids.slice(0, MAX_SERVICE_ID_COUNT)
			};
			logger.info("Found services ids mappings in user config files");
		}
	}

	// Trim the input data to only include the required attributes
	const output =  { deployments } ;

	if (hasTooManyPatternsPerEnvironment(output)) {
		throw new Error(`Too many patterns per environment! Maximum is: ${MAX_PATTERNS_PER_ENVIRONMENT}`);
	}
	return output;
};

const updateRepoConfigFromGitHub = async (repoSyncState: RepoSyncState, gitHubInstallationClient: GitHubInstallationClient, logger: Logger): Promise<void> => {

	const yamlConfig = await getRepoConfigFromGitHub(gitHubInstallationClient, repoSyncState.repoOwner, repoSyncState.repoName);
	if (!yamlConfig) {
		logger.info("Unable to fetch content of user config file from GitHub");
	}

	const config = convertYamlToUserConfig(yamlConfig, logger);
	await repoSyncState.update({ config });
	logger.info("Update repoSyncState for user config successfully");
};

/**
 * Checks for the user config file in the given repositories and stores the config in the database.
 * If an error occurs for one of the repositories, we'll just log it and continue on with the
 * other repositories.
 * @param repoSyncStates the repositories in which to look for the config file
 * @param githubInstallationId the GitHub installation ID the repositories belong to
 * @param jiraHost
 * @param gitHubAppId the primary key (postgres) of the GitHub Server App, if for server app
 */
export const updateRepoConfigsFromGitHub = async (repoSyncStates: RepoSyncState[], gitHubInstallationClient: GitHubInstallationClient, logger: Logger): Promise<void> => {
	await Promise.all(repoSyncStates.map(async (repoSyncState) => {
		await updateRepoConfigFromGitHub(repoSyncState, gitHubInstallationClient, logger)
			.catch((err: unknown) => { logger.error({
				err,
				gitHubInstallationId: gitHubInstallationClient.githubInstallationId,
				repositoryId: repoSyncState.repoId
			}, "error while updating a single repo config"); });
	}));
};
