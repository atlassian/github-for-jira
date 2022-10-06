import { Repository } from "models/subscription";
import { transformRepositoryId } from "./transform-repository-id";
import { BulkSubmitRepositoryInfo } from "interfaces/jira";

/**
 * @param repository
 * @param ghesBaseUrl - must be defined for Server and undefined for Cloud
 */
export const transformRepositoryDevInfoBulk = (repository: Repository, ghesBaseUrl?: string): BulkSubmitRepositoryInfo => {
	return {
		id: transformRepositoryId(repository.id, ghesBaseUrl),
		name: repository.full_name,
		url: repository.html_url,
		updateSequenceId: Date.now()
	};
};
