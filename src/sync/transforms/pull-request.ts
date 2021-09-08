import { GitHubAPI } from "probot";
import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../../jira/util/isEmpty";
import { getJiraAuthor } from "../../util/jira";
import { getGithubUser } from "../../services/github/getGithubUser";

// TODO: better typings in file
function mapStatus({ state, merged_at }): string {
	if (state === "merged") return "MERGED";
	if (state === "open") return "OPEN";
	if (state === "closed" && merged_at) return "MERGED";
	if (state === "closed" && !merged_at) return "DECLINED";
	return "UNKNOWN";
}

export default async (payload, github: GitHubAPI) => {
	const { pullRequest, repository } = payload;
	// This is the same thing we do in transforms, concat'ing these values
	const issueKeys = issueKeyParser().parse(
		`${pullRequest.title}\n${pullRequest.head.ref}`
	);

	if (isEmpty(issueKeys)) {
		return undefined;
	}

	const prGet = await github?.pulls?.get({
		owner: repository.owner.login,
		repo: repository.name,
		pull_number: pullRequest.number
	});

	const commentCount = prGet?.data.comments;

	return {
		id: repository.id,
		name: repository.full_name,
		pullRequests: [
			{
				// Need to get full name from a REST call as `pullRequest.author` doesn't have it
				author: getJiraAuthor(pullRequest.author, await getGithubUser(github, pullRequest.author?.login)),
				commentCount,
				destinationBranch: `${repository.html_url}/tree/${
					pullRequest.base ? pullRequest.base.ref : ""
				}`,
				displayId: `#${pullRequest.number}`,
				id: pullRequest.number,
				issueKeys,
				lastUpdate: pullRequest.updated_at,
				sourceBranch: `${pullRequest.head ? pullRequest.head.ref : ""}`,
				sourceBranchUrl: `${repository.html_url}/tree/${
					pullRequest.head ? pullRequest.head.ref : ""
				}`,
				status: mapStatus(pullRequest),
				timestamp: pullRequest.updated_at,
				title: pullRequest.title,
				url: pullRequest.html_url,
				updateSequenceId: Date.now()
			}
		],
		url: repository.html_url,
		updateSequenceId: Date.now()
	};
};
