import YAML from "yaml";
import GitHubClient from "../github/client/github-client";
import { getCloudInstallationId } from "../github/client/installation-id";
import { getLogger } from "../config/logger";
import { RepoConfig } from "./repo-config";
import RepoConfigDatabaseModel from "./repo-config-database-model";

const logger = getLogger("services.config-as-code");
const CONFIG_PATH = "config.yml";

const getRepoConfig = async (githubInstallationId: number, owner: string, repo: string): Promise<string | null> => {
	const client = new GitHubClient(getCloudInstallationId(githubInstallationId), logger);

	try {
		const response = await client.getRepositoryContent(owner, repo, CONFIG_PATH)
		const contentString = Buffer.from(response.data.content, "base64").toString("ascii"); 
		logger.debug(`Converted ${response.data.content} to ${contentString}`);

		return contentString;
	} catch (err) {
		logger.error(err, "Get repo failed.");
		return null;
	}
}

// todo generic utils class....
const convertYamlToRepoConfig = (input: string): RepoConfig => {
	return YAML.parse(input)
}

// save the json blob to the DB with installationId and RepoId
const saveRepoConfigToDB = async (githubInstallationId: number, repoId: number, config: RepoConfig) => {
	logger.debug(`saving repo config to Databse ---- intstallationId:${githubInstallationId}, repoId:${repoId}, config${config}`);
	try {
		await RepoConfigDatabaseModel.saveOrUpdate( githubInstallationId, repoId, config )
	}
	catch (err) {
		logger.error(err, "Failed to commit config changes to database.");
	}
	return null;
}

// USED TO TEST
export const processRepoConfig = async (githubInstallationId: number, owner: string, repo: string) => {
	const buffer = await getRepoConfig(githubInstallationId, owner, repo);
	if(buffer) {
		const config : RepoConfig = convertYamlToRepoConfig(buffer);
		await saveRepoConfigToDB(githubInstallationId, 11111, config);
	}
}
