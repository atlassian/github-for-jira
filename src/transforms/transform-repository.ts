import { Repository } from "models/subscription";
import { transformRepositoryId } from "./transform-repository-id";
import { BulkSubmitRepositoryInfo } from "interfaces/jira";

/**
 * @param repository
 * @param gitHubBaseUrl - can be undefined for Cloud
 */
export const transformRepositoryDevInfoBulk = async (repository: Repository, gitHubBaseUrl?: string): Promise<BulkSubmitRepositoryInfo> => {
	return {
		id: await transformRepositoryId(repository.id, gitHubBaseUrl),
		name: repository.full_name,
		url: repository.html_url,
		updateSequenceId: Date.now()
	};
};
