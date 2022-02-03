import YAML from "yaml";
import GitHubClient from "../github/client/github-client";
import { getCloudInstallationId } from "../github/client/installation-id";
import { getLogger } from "../config/logger";
import { RepoConfig } from "./repo-config";
import RepoConfigDatabaseModel from "./repo-config-database-model";

const logger = getLogger("services.config-as-code");
const CONFIG_PATH = ".jira/config.yml";
const MAX_PATTERNS_PER_ENVIRONMENT = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024;

/**
 * Tests if filesize is greater than maximum - MAX_FILE_SIZE_BYTES
 */
export const isFileTooBig = (fileSize: number): boolean => {
	return fileSize > MAX_FILE_SIZE_BYTES;
}

/**
 * Iterates through environment patterns and returns true if any environment contains too many patterns to test against.
 */
export const hasTooManyPatternsPerEnvironment = (config: RepoConfig): boolean => {
	const environmentMapping = config.deployments.environmentMapping;
	return Object.keys(environmentMapping).some(key => {
		return environmentMapping[key].length > MAX_PATTERNS_PER_ENVIRONMENT
	});
}

/**
 * Fetches contents from CONFIG_PATH using guthub api, transforms its from base64 to ascii and returns the transformed string.
 */
export const getRepoConfigFromGitHub = async (githubInstallationId: number, owner: string, repo: string): Promise<string | null> => {
	const client = new GitHubClient(getCloudInstallationId(githubInstallationId), logger);
	const response = await client.getRepositoryContent(owner, repo, CONFIG_PATH);

	if (response == null) {
		return null;
	}

	if (response.data === undefined || Array.isArray(response.data) || response.data.content === undefined) {
		return null;
	}

	if (isFileTooBig(response.data.size)) {
		throw new Error(`file size ${response.data.size} is too large, max file size is ${MAX_FILE_SIZE_BYTES} bytes`)
	}

	const contentString = Buffer.from(response.data.content, "base64").toString("ascii");
	logger.info(`Converted ${response.data.content} to ${contentString}`);
	return contentString;
}

/**
 * Call this function when a file in the repository has been updated. If it's the config-as-code file, it will load
 * the file from the repository and update the config in the database.
 */
export const fileTouched = async (githubInstallationId: number, owner: string, repo: string, repoId: number, filename: string) => {
	if (filename != CONFIG_PATH) {
		return;
	}
	await updateRepoConfig(githubInstallationId, owner, repo, repoId);
}

/**
 * Checks if the given file is the config-as-code file and removes the repo config from the database if it is.
 */
export const fileRemoved = async (githubInstallationId: number, repoId: number, filename: string) => {
	if (filename != CONFIG_PATH) {
		return;
	}
	logger.info({ githubInstallationId, repoId }, `removing repo config because ${CONFIG_PATH} was deleted`);
	await RepoConfigDatabaseModel.deleteForRepo(githubInstallationId, repoId);
}

/**
 * Converts incoming YAML string to JSON (RepoConfig)
 */
export const convertYamlToRepoConfig = (input: string): RepoConfig => {

	const config: RepoConfig = YAML.parse(input);

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

/**
 * Saves a JSON blob to the RepoConfig database with installationId and RepoId
 */
export const saveRepoConfigToDB = async (githubInstallationId: number, repoId: number, config: RepoConfig): Promise<RepoConfig | null> => {
	return await RepoConfigDatabaseModel.saveOrUpdate(githubInstallationId, repoId, config)
}

/**
 * Attempts to find ./jira/config.yaml on main branch, parse it from YAML to JSON, then commit it to RepoConfig database.
 */
export const updateRepoConfig = async (githubInstallationId: number, owner: string, repo: string, repoId: number): Promise<RepoConfig | null> => {
	const buffer = await getRepoConfigFromGitHub(githubInstallationId, owner, repo);
	if (buffer) {
		const config: RepoConfig = convertYamlToRepoConfig(buffer);
		logger.info({
			githubInstallationId,
			repo,
			repoId,
			owner
		}, `updating repo config from ${CONFIG_PATH}`);
		return await saveRepoConfigToDB(githubInstallationId, repoId, config);
	}
	logger.info({
		githubInstallationId,
		repo,
		repoId,
		owner
	}, `could not find config file ${CONFIG_PATH} for this repository`)
	return null;
}
