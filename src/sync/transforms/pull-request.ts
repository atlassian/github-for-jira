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

	const prGet = (await github?.pulls?.get({
		owner: repository.owner.login,
		repo: repository.name,
		pull_number: pullRequest.number
	})).data;

	const commentCount = prGet?.comments;

	return {
		id: repository.id,
		name: repository.full_name,
		pullRequests: [
			{
				// Need to get full name from a REST call as `pullRequest.author` doesn't have it
				author: getJiraAuthor(await getGithubUser(github, prGet.user?.login)),
				commentCount,
				destinationBranch: `${repository.html_url}/tree/${prGet.base?.ref || ""}`,
				displayId: `#${prGet.number}`,
				id: prGet.number,
				issueKeys,
				lastUpdate: prGet.updated_at,
				sourceBranch: `${prGet.head?.ref || ""}`,
				sourceBranchUrl: `${repository.html_url}/tree/${prGet.head?.ref || ""}`,
				status: mapStatus(prGet),
				timestamp: prGet.updated_at,
				title: prGet.title,
				url: prGet.html_url,
				updateSequenceId: Date.now()
			}
		],
		url: repository.html_url,
		updateSequenceId: Date.now()
	};
};
