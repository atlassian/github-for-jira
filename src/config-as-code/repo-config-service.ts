import YAML from "yaml";
import GitHubClient from "../github/client/github-client";
import { getCloudInstallationId } from "../github/client/installation-id";
import { getLogger } from "../config/logger";
import { RepoConfig } from "./repo-config";
import RepoConfigDatabaseModel from "./repo-config-database-model";

const logger = getLogger("services.config-as-code");
const CONFIG_PATH = "./jira/config.yml";

const getRepoConfigFromGitHub = async (githubInstallationId: number, owner: string, repo: string): Promise<string | null> => {
	const client = new GitHubClient(getCloudInstallationId(githubInstallationId), logger);
	const response = await client.getRepositoryContent(owner, repo, CONFIG_PATH);
	if(response.data === undefined || Array.isArray(response.data) || response.data.content === undefined) {
		return null;
	}
	const contentString = Buffer.from(response.data.content, "base64").toString("ascii"); 
	logger.debug(`Converted ${response.data.content} to ${contentString}`);
	return contentString;
}

const convertYamlToRepoConfig = (input: string): RepoConfig => {
	return YAML.parse(input)
}

// save the json blob to the DB with installationId and RepoId
const saveRepoConfigToDB = async (githubInstallationId: number, repoId: number, config: RepoConfig): Promise<RepoConfig | null> => {
	logger.debug(`saving repo config to Databse ---- intstallationId:${githubInstallationId}, repoId:${repoId}, config${config}`);
	return await RepoConfigDatabaseModel.saveOrUpdate( githubInstallationId, repoId, config )
}

// Attempt to find ./jira/config.yaml on main branch, parse it from yaml to JSON, then commit it to database.
export const processRepoConfig = async (githubInstallationId: number, owner: string, repo: string, repoId: number): Promise<RepoConfig | null> => {
	const buffer = await getRepoConfigFromGitHub(githubInstallationId, owner, repo);
	if(buffer) {
		const config : RepoConfig = convertYamlToRepoConfig(buffer);
		return await saveRepoConfigToDB(githubInstallationId, repoId, config);
	} 
	logger.info("could not find repo config ---- intstallationId:${githubInstallationId}, repo:${repo}, repoId:${repoId}, owner${owner}")
	return null;
}
