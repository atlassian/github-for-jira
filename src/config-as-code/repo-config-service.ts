import YAML from "yaml";
import GitHubClient from "../github/client/github-client";
import { getCloudInstallationId } from "../github/client/installation-id";
import { getLogger } from "../config/logger";
import { RepoConfig } from "./repo-config";
import RepoConfigDatabaseModel from "./repo-config-database-model";

const logger = getLogger("services.config-as-code");
const CONFIG_PATH = ".jira/config.yml";

/**
 * Fetches contents from CONFIG_PATH using guthub api, transforms its from base64 to ascii and returns the transformed string.
 */
const getRepoConfigFromGitHub = async (githubInstallationId: number, owner: string, repo: string): Promise<string | null> => {
	const client = new GitHubClient(getCloudInstallationId(githubInstallationId), logger);
	const response = await client.getRepositoryContent(owner, repo, CONFIG_PATH);
	if (response == null) {
		return null;
	}

	if (response.data === undefined || Array.isArray(response.data) || response.data.content === undefined) {
		return null;
	}

	const contentString = Buffer.from(response.data.content, "base64").toString("ascii");
	logger.debug(`Converted ${response.data.content} to ${contentString}`);
	return contentString;
}

/**
 * Converts incoming YAML string to JSON (RepoConfig)
 */
const convertYamlToRepoConfig = (input: string): RepoConfig => {
	const config: RepoConfig = YAML.parse(input);
	return config;
}

/**
 * Saves a JSON blob to the RepoConfig database with installationId and RepoId
 */
const saveRepoConfigToDB = async (githubInstallationId: number, repoId: number, config: RepoConfig): Promise<RepoConfig | null> => {
	logger.debug({githubInstallationId, repoId, config}, "saving repo config to Database");
	return await RepoConfigDatabaseModel.saveOrUpdate(githubInstallationId, repoId, config)
}

/**
 * Attempts to find ./jira/config.yaml on main branch, parse it from YAML to JSON, then commit it to RepoConfig database.
 */
export const processRepoConfig = async (githubInstallationId: number, owner: string, repo: string, repoId: number): Promise<RepoConfig | null> => {
	const buffer = await getRepoConfigFromGitHub(githubInstallationId, owner, repo);
	if (buffer) {
		const config: RepoConfig = convertYamlToRepoConfig(buffer);
		return await saveRepoConfigToDB(githubInstallationId, repoId, config);
	}
	logger.info({ githubInstallationId, repo, repoId, owner }, "could not find repo config or config is empty - expected .jira/config.yml")
	return null;
}
