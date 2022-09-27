import { getJiraAuthor, jiraIssueKeyParser } from "utils/jira-utils";
import { isEmpty } from "lodash";
import { Octokit } from "@octokit/rest";
import { Repository } from "models/subscription";

// TODO: better typings in file
function mapStatus({ state, merged_at }): string {
	if (state === "merged") return "MERGED";
	if (state === "open") return "OPEN";
	if (state === "closed" && merged_at) return "MERGED";
	if (state === "closed" && !merged_at) return "DECLINED";
	return "UNKNOWN";
}

interface Payload {
	pullRequest: Octokit.PullsListResponseItem;
	repository: Repository;
}

export const transformPullRequest =  async (payload: Payload, prDetails: Octokit.PullsGetResponse, ghUser?: Octokit.UsersGetByUsernameResponse) => {
	const { pullRequest, repository } = payload;
	// This is the same thing we do in transforms, concat'ing these values
	const issueKeys = jiraIssueKeyParser(`${pullRequest.title}\n${pullRequest.head.ref}`);

	if (isEmpty(issueKeys)) {
		return undefined;
	}

	return {
		// here
		id: repository.id.toString(),
		name: repository.full_name,
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
		],
		url: repository.html_url,
		updateSequenceId: Date.now()
	};
};
