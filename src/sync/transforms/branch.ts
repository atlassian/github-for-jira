import { getJiraId } from "~/src/jira/util/id";
import { getJiraAuthor, jiraIssueKeyParser, limitCommitMessage } from "utils/jira-utils";
import { isEmpty, union } from "lodash";
import { generateCreatePullRequestUrl } from "../../transforms/util/pull-request-link-generator";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { Repository } from "models/subscription";
import { Branch } from "~/src/github/client/github-client.types";

// TODO: better typing in file
/**
 * mapBranch takes a branch node from the GraphQL response and
 * attempts to find issueKeys in use anywhere in that object
 *
 * Locations can include:
 *  - Branch Name (ref)
 *  - Title of the last associated Pull Request
 *  - Message from the last commit in that branch
 */
const mapBranch = (branch: Branch, repository: Repository, alwaysSend: boolean) => {
	const branchKeys = jiraIssueKeyParser(branch.name);
	const pullRequestKeys = jiraIssueKeyParser(
		branch.associatedPullRequests.nodes.length ? branch.associatedPullRequests.nodes[0].title : ""
	);
	const commitKeys = jiraIssueKeyParser(branch.target.message);
	const allKeys = union(branchKeys, pullRequestKeys, commitKeys)
		.filter((key) => !!key);

	if (!allKeys.length && !alwaysSend) {
		// If we get here, no issue keys were found anywhere they might be found
		return undefined;
	}

	return {
		createPullRequestUrl: generateCreatePullRequestUrl(repository.html_url, branch.name, allKeys),
		id: getJiraId(branch.name),
		issueKeys: allKeys,
		lastCommit: {
			author: getJiraAuthor(branch.target.author, branch.target.history.nodes?.[0]?.author),
			authorTimestamp: branch.target.authoredDate,
			displayId: branch.target.oid.substring(0, 6),
			fileCount: branch.target.changedFiles || 0,
			hash: branch.target.oid,
			id: branch.target.oid,
			issueKeys: commitKeys,
			message: limitCommitMessage(branch.target.message),
			url: branch.target.url || undefined,
			updateSequenceId: Date.now()
		},
		name: branch.name,
		url: `${repository.html_url}/tree/${branch.name}`,
		updateSequenceId: Date.now()
	};
};

/**
 * mapCommit takes the a single commit object from the array
 * of commits we got from the GraphQL response and maps the data
 * to the structure needed for the DevInfo API
 */
const mapCommit = (commit, alwaysSend: boolean) => {
	const issueKeys = jiraIssueKeyParser(commit.message);

	if (isEmpty(issueKeys) && !alwaysSend) {
		return undefined;
	}

	return {
		author: getJiraAuthor(commit.author),
		authorTimestamp: commit.authoredDate,
		displayId: commit.oid.substring(0, 6),
		fileCount: 0,
		hash: commit.oid,
		id: commit.oid,
		issueKeys: issueKeys || [],
		message: limitCommitMessage(commit.message),
		timestamp: commit.authoredDate,
		url: commit.url,
		updateSequenceId: Date.now()
	};
};

// TODO: add typings
/**
 *
 * @param payload
 * @param gitHubBaseUrl - can be undefined for Cloud
 */
export const transformBranches = (payload: { branches: any, repository: Repository }, gitHubBaseUrl: string | undefined, alwaysSendBranches: boolean, alwaysSendCommits: boolean) => {
	// TODO: use reduce instead of map/filter
	const branches = payload.branches
		.map((branch) => mapBranch(branch, payload.repository, alwaysSendBranches))
		.filter((branch) => !!branch);

	// TODO: use reduce instead of map/filter
	const commits = payload.branches.flatMap((branch) =>
		branch.target.history.nodes
			.map((commit) => mapCommit(commit, alwaysSendCommits))
			.filter((branch) => !!branch)
	);

	if ((!commits || !commits.length) && (!branches || !branches.length)) {
		return undefined;
	}

	return {
		... transformRepositoryDevInfoBulk(payload.repository, gitHubBaseUrl),
		branches,
		commits
	};
};
