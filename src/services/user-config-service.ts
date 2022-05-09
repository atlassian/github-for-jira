import {getCloudInstallationId} from "~/src/github/client/installation-id";
import {getLogger} from "config/logger";
import {GitHubInstallationClient} from "~/src/github/client/github-installation-client";
import {RepoSyncState} from "models/reposyncstate";
import {Config} from "interfaces/common";
import YAML from "yaml";

const USER_CONFIG_FILE = ".jira/config.yml";
const logger = getLogger("services.user-config");
const MAX_PATTERNS_PER_ENVIRONMENT = 10;

export const updateRepoConfig = async (repoSyncState: RepoSyncState, githubInstallationId: number, modifiedFiles: string[] = []): Promise<void> => {
	// Only get save the latest repo config if the file in the repository changed (added, modified or removed)
	if (modifiedFiles.includes(USER_CONFIG_FILE)) {
		try {
			await updateRepoConfigFromGitHub(repoSyncState, githubInstallationId);
		} catch (err) {
			logger.error({
				err,
				githubInstallationId,
				repoSyncStateId: repoSyncState.id
			}, "error while updating the repo config");
		}
	}
};

/**
 * Fetches contents from CONFIG_PATH from GitHub via GitHub's API, transforms it from base64 to ascii and returns the transformed string.
 */
const getRepoConfigFromGitHub = async (githubInstallationId: number, owner: string, repo: string): Promise<string | undefined> => {
	const client = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), logger);
	const contents = await client.getRepositoryFile(owner, repo, USER_CONFIG_FILE);

	if (!contents) {
		return undefined;
	}

	return Buffer.from(contents, "base64").toString("utf-8");
}

/**
 * Iterates through environment patterns and returns true if any environment contains too many patterns to test against.
 */
const hasTooManyPatternsPerEnvironment = (config: Config): boolean => {
	const environmentMapping = config?.deployments?.environmentMapping;
	if (!environmentMapping) {
		return false;
	}
	return Object.keys(environmentMapping).some(key => {
		return environmentMapping[key].length > MAX_PATTERNS_PER_ENVIRONMENT
	});
}

/**
 * Converts incoming YAML string to JSON (RepoConfig)
 */
const convertYamlToUserConfig = (input?: string): Config => {

	if (!input) {
		return {};
	}

	const config: Config = YAML.parse(input);

	if (!config?.deployments?.environmentMapping) {
		throw new Error(`Invalid .jira/config.yml structure`);
	}

	// Trim the input data to only include the required attributes
	const output = {
		deployments: {
			environmentMapping: {
				development: config.deployments.environmentMapping.development,
				testing: config.deployments.environmentMapping.testing,
				staging: config.deployments.environmentMapping.staging,
				production: config.deployments.environmentMapping.production,
			}
		}
	}

	if (hasTooManyPatternsPerEnvironment(output)) {
		throw new Error(`Too many patterns per environment! Maximum is: ${MAX_PATTERNS_PER_ENVIRONMENT}`)
	}
	return output;
}

const updateRepoConfigFromGitHub = async (repoSyncState: RepoSyncState, githubInstallationId: number): Promise<void> => {
	const yamlConfig = await getRepoConfigFromGitHub(githubInstallationId, repoSyncState.repoOwner, repoSyncState.repoName);
	const config = convertYamlToUserConfig(yamlConfig);
	await repoSyncState.update({config});
}
