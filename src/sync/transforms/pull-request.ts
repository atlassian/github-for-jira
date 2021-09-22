import issueKeyParser from "jira-issue-key-parser";
import { getJiraAuthor } from "../../util/jira";
import _ from "lodash";
import { PullRequest } from "../../services/github/pull-requests";
import { JiraPullRequest, JiraPullRequestStatus } from "../../interfaces/jira";

function mapStatus({ state, merged }: PullRequest): JiraPullRequestStatus {
	if (state === "MERGED") return "MERGED";
	if (state === "OPEN") return "OPEN";
	if (state === "CLOSED" && merged) return "MERGED";
	if (state === "CLOSED" && !merged) return "DECLINED";
	return "UNKNOWN";
}

export default (pullRequest: PullRequest): JiraPullRequest | undefined => {
	// This is the same thing we do in transforms, concat'ing these values
	const issueKeys = issueKeyParser().parse(
		`${pullRequest.title}\n${pullRequest.headRef?.name || ""}`
	) || [];

	if (_.isEmpty(issueKeys)) {
		return undefined;
	}

	return {
		// Need to get full name from a REST call as `pullRequest.author` doesn't have it
		author: getJiraAuthor(pullRequest.author),
		commentCount: pullRequest.comments.totalCount,
		displayId: `#${pullRequest.number}`,
		id: pullRequest.number.toString(),
		// TODO: this should probably use pullRequest.id instead of pullRequest.number
		issueKeys,
		lastUpdate: pullRequest.updatedAt,
		sourceBranch: pullRequest.headRef?.name || "",
		sourceBranchUrl: `${pullRequest.repository.url}/tree/${pullRequest.headRef?.name || ""}`,
		destinationBranch: `${pullRequest.repository.url}/tree/${pullRequest.baseRef?.name || ""}`,
		status: mapStatus(pullRequest),
		timestamp: pullRequest.updatedAt,
		title: pullRequest.title,
		url: pullRequest.url,
		updateSequenceId: Date.now()
	};
};
