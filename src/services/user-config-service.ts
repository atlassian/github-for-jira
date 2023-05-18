import { getLogger } from "config/logger";
import { RepoSyncState } from "models/reposyncstate";
import { Config } from "interfaces/common";
import YAML from "yaml";
import { InstallationId } from "../github/client/installation-id";
import { Subscription } from "models/subscription";
import { createInstallationClient } from "utils/get-github-client-config";

const USER_CONFIG_FILE = ".jira/config.yml";
const logger = getLogger("services.user-config");
const MAX_PATTERNS_PER_ENVIRONMENT = 10;
const MAX_SERVICE_ID_COUNT = 100;

export const isUseConfigFile = (file: string) => {
	return (file || "").toLowerCase().trim() === USER_CONFIG_FILE;
};

/**
 * Checks whether a list of modified files contains the config file. If yes, reads that config file
 * from the GitHub repository, parses it, and stores the config against the given repository
 * in the database.
 *
 * This function is meant to be called whenever there is a change in the repository so we can check
 * if the config file has changed.
 *
 * @param subscription the subscription to which the repository belongs.
 * @param repositoryId the ID of the repository.
 * @param githubInstallationId the ID of the installation to which the repository belongs.
 * @param modifiedFiles list of modified files (added, modified, or removed). The config will only be updated if this list contains
 * the config file.
 */
export const updateRepoConfig = async (
	subscription: Subscription,
	repositoryId: number,
	githubInstallationId: InstallationId,
	metrics: { trigger: string, subTrigger?: string },
	modifiedFiles: string[] = []
): Promise<void> => {

	if (modifiedFiles.includes(USER_CONFIG_FILE)) {
		try {
			const repoSyncState = await RepoSyncState.findByRepoId(subscription, repositoryId);

			if (!repoSyncState) {
				logger.error({
					githubInstallationId,
					repositoryId
				}, "could not find RepoSyncState for repo");
				return;
			}

			await updateRepoConfigsFromGitHub([repoSyncState], githubInstallationId, subscription.jiraHost, subscription.gitHubAppId, metrics);
		} catch (err) {
			logger.error({
				err,
				githubInstallationId,
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
	installationId: InstallationId,
	repositoryId: number,
	repoOwner: string,
	repoName: string,
	metrics: { trigger: string, subTrigger?: string }
): Promise<Config | undefined> => {
	// In the future, we may look in other places for a config than just in the RepoSyncState (for example,
	// we might fall back to default configs on the level of a subscription or an installation).
	const repoSyncState = await RepoSyncState.findByRepoId(subscription, repositoryId);

	// Edge case: we don't have a record of the repository in our DB, yet, so we're loading the
	// config directly from the config file in the GitHub repo.
	if (!repoSyncState) {
		const yamlConfig = await getRepoConfigFromGitHub(installationId, repoOwner, repoName, subscription.jiraHost, subscription.gitHubAppId, metrics);
		return convertYamlToUserConfig(yamlConfig);
	}

	// Standard case: we return the config from our database.
	return repoSyncState.config;
};

/**
 * Fetches contents from CONFIG_PATH from GitHub via GitHub's API, transforms it from base64 to ascii and returns the transformed string.
 */
const getRepoConfigFromGitHub = async (githubInstallationId: InstallationId, owner: string, repo: string, jiraHost: string, gitHubAppId: number | undefined, metrics: { trigger: string, subTrigger?: string }): Promise<string | undefined> => {
	const client = await createInstallationClient(githubInstallationId.installationId, jiraHost, metrics, logger, gitHubAppId);
	const contents = await client.getRepositoryFile(owner, repo, USER_CONFIG_FILE);

	if (!contents) {
		return undefined;
	}
	return Buffer.from(contents, "base64").toString("utf-8");
};

/**
 * Iterates through environment patterns and returns true if any environment contains too many patterns to test against.
 */
const hasTooManyPatternsPerEnvironment = (config: Config): boolean => {
	const environmentMapping = config?.deployments?.environmentMapping;
	if (!environmentMapping) {
		return false;
	}
	return Object.keys(environmentMapping).some(key => {
		return environmentMapping[key]?.length > MAX_PATTERNS_PER_ENVIRONMENT;
	});
};

/**
 * Converts incoming YAML string to JSON (RepoConfig)
 */
const convertYamlToUserConfig = (input?: string): Config => {

	if (!input) {
		return {};
	}

	const config: Config = YAML.parse(input);

	const configDeployments = config?.deployments;
	const deployments = {};
	if (configDeployments != null) {
		if (configDeployments.environmentMapping) {
			deployments["environmentMapping"] =  {
				development: configDeployments.environmentMapping.development,
				testing: configDeployments.environmentMapping.testing,
				staging: configDeployments.environmentMapping.staging,
				production: configDeployments.environmentMapping.production
			};
		}
		if (configDeployments.services?.ids) {
			deployments["services"] = {
				ids: configDeployments.services.ids.slice(0, MAX_SERVICE_ID_COUNT)
			};
		}
	}


	if (!deployments) {
		throw new Error(`Invalid .jira/config.yml structure`);
	}

	// Trim the input data to only include the required attributes
	const output =  { deployments } ;

	if (hasTooManyPatternsPerEnvironment(output)) {
		throw new Error(`Too many patterns per environment! Maximum is: ${MAX_PATTERNS_PER_ENVIRONMENT}`);
	}
	return output;
};

const updateRepoConfigFromGitHub = async (repoSyncState: RepoSyncState, githubInstallationId: InstallationId, jiraHost: string, gitHubAppId: number | undefined, metrics: { trigger: string, subTrigger?: string }): Promise<void> => {
	const yamlConfig = await getRepoConfigFromGitHub(githubInstallationId, repoSyncState.repoOwner, repoSyncState.repoName, jiraHost, gitHubAppId, metrics);
	const config = convertYamlToUserConfig(yamlConfig);
	await repoSyncState.update({ config });
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
export const updateRepoConfigsFromGitHub = async (repoSyncStates: RepoSyncState[], githubInstallationId: InstallationId, jiraHost: string, gitHubAppId: number | undefined, metrics: { trigger: string, subTrigger?: string }): Promise<void> => {
	await Promise.all(repoSyncStates.map(async (repoSyncState) => {
		await updateRepoConfigFromGitHub(repoSyncState, githubInstallationId, jiraHost, gitHubAppId, metrics)
			.catch(err => logger.error({
				err,
				githubInstallationId,
				repositoryId: repoSyncState.repoId
			}, "error while updating a single repo config"));
	}));
};
