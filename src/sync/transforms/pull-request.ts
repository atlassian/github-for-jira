import { getJiraAuthor, jiraIssueKeyParser } from "utils/jira-utils";
import { isEmpty } from "lodash";
import { Octokit } from "@octokit/rest";
import { Repository } from "models/subscription";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";

// TODO: better typings in file
const mapStatus = ({ state, merged_at }): string => {
	if (state === "merged") return "MERGED";
	if (state === "open") return "OPEN";
	if (state === "closed" && merged_at) return "MERGED";
	if (state === "closed" && !merged_at) return "DECLINED";
	return "UNKNOWN";
};

interface Payload {
	pullRequest: Octokit.PullsListResponseItem;
	repository: Repository;
}

/**
 *
 * @param payload
 * @param prDetails
 * @param gitHubBaseUrl - can be undefined for Cloud
 * @param ghUser
 */
export const transformPullRequest =  (payload: Payload, prDetails: Octokit.PullsGetResponse, gitHubBaseUrl?: string, ghUser?: Octokit.UsersGetByUsernameResponse) => {
	const { pullRequest, repository } = payload;
	// This is the same thing we do in transforms, concat'ing these values
	const issueKeys = jiraIssueKeyParser(`${pullRequest.title}\n${pullRequest.head.ref}`);

	if (isEmpty(issueKeys)) {
		return undefined;
	}

	return {
		... transformRepositoryDevInfoBulk(repository, gitHubBaseUrl),
		pullRequests: [
			{
				// Need to get full name from a REST call as `pullRequest.author` doesn't have it
				author: getJiraAuthor(prDetails.user, ghUser),
				commentCount: prDetails.comments || 0,
				destinationBranch: prDetails.base?.ref || "",
				destinationBranchUrl: `${repository.html_url}/tree/${prDetails.base?.ref || ""}`,
				displayId: `#${prDetails.number}`,
				id: prDetails.number,
				issueKeys,
				lastUpdate: prDetails.updated_at,
				sourceBranch: `${prDetails.head?.ref || ""}`,
				sourceBranchUrl: `${repository.html_url}/tree/${prDetails.head?.ref || ""}`,
				status: mapStatus(prDetails),
				timestamp: prDetails.updated_at,
				title: prDetails.title,
				url: prDetails.html_url,
				updateSequenceId: Date.now()
			}
		]
	};
};
