import {getCloudInstallationId} from "~/src/github/client/installation-id";
import {getLogger} from "config/logger";
import {GitHubAppClient} from "~/src/github/client/github-app-client";
import {GitHubInstallationClient} from "~/src/github/client/github-installation-client";
import {RepoSyncState} from "models/reposyncstate";
import {Config} from "interfaces/common";

const USER_CONFIG_FILE = ".jira/config.yml";
const logger = getLogger("services.user-config");

export const updateRepoConfig = async (modifiedFiles: string[] = []): Promise<void> => {
	// Only get save the latest repo config if the file in the repository changed (added, modified or removed)
	if (modifiedFiles.includes(USER_CONFIG_FILE)) {
		try {
			await saveRepoConfig();
		} catch(err) {

		}
	}
};

const saveRepoConfig = async (repoSyncState:RepoSyncState, githubInstallationId: number): Promise<void> => {
 await repoSyncState.update({config: await getRepoConfigFromGitHub(githubInstallationId, repoSyncState.repoOwner, repoSyncState.repoName)});
};

/**
 * Fetches contents from CONFIG_PATH using guthub api, transforms its from base64 to ascii and returns the transformed string.
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
 * Converts incoming YAML string to JSON (RepoConfig)
 */
const convertYamlToUserConfig = (input: string): Config => {

	const config: Config = YAML.parse(input);

	if(!config?.deployments?.environmentMapping) {
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
