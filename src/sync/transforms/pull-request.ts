import { getJiraAuthor } from "utils/jira-utils";
import { isEmpty } from "lodash";
import { Octokit } from "@octokit/rest";
import { Repository } from "models/subscription";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { mapStatus } from "~/src/transforms/transform-pull-request";
import { extractIssueKeysFromPr } from "~/src/transforms/transform-pull-request";

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
	const { repository } = payload;
	// This is the same thing we do in transforms, concat'ing these values
	const issueKeys = extractIssueKeysFromPr(payload.pullRequest);

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
				status: mapStatus(prDetails.state, prDetails.draft, prDetails.merged_at),
				timestamp: prDetails.updated_at,
				title: prDetails.title,
				url: prDetails.html_url,
				updateSequenceId: Date.now()
			}
		]
	};
};
