
declare const transformedRepositoryId: unique symbol;

export type TransformedRepositoryId = string & { [transformedRepositoryId]: never };

export function transformRepositoryId(repositoryId: number, gitHubBaseUrl?: string): TransformedRepositoryId {
	if (!gitHubBaseUrl) {
		return ("" + repositoryId) as TransformedRepositoryId;
	}

	// "1024" is the limit for repo id in Jira API, see
	// https://developer.atlassian.com/cloud/jira/software/rest/api-group-development-information/#api-group-development-information ,
	// therefore limiting to 512 (half of the limit).
	// Not base64 to avoid handling of special symbols (+/=) that are not allowed in Jira API.
	const prefix = Buffer.from(gitHubBaseUrl).toString('hex').substring(0, 512);

	return `${prefix}-${repositoryId}` as TransformedRepositoryId;
}
