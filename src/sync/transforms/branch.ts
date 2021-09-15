import { getJiraId } from "../../jira/util/id";
import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../../jira/util/isEmpty";
import { getJiraAuthor } from "../../util/jira";

// TODO: better typing in file
/**
 * mapBranch takes a branch node from the GraphQL response and
 * attempts to find issueKeys in use anywhere in that object
 *
 * Locations can include:
 *  - Branch Name (ref)
 *  - Title of the associated Pull Request
 *  - Messages from up to the last 100 commits in that branch
 */
function mapBranch(branch, repository) {
	const branchKeys = issueKeyParser().parse(branch.name);
	const pullRequestKeys = issueKeyParser().parse(
		branch.associatedPullRequests.nodes.length ? branch.associatedPullRequests.nodes[0].title : ""
	);
	const commitKeys = issueKeyParser().parse(branch.target.message);

	const allKeys = branchKeys
		.concat(pullRequestKeys)
		.concat(commitKeys)
		.filter((key) => !!key);

	if (!allKeys.length) {
		// If we get here, no issue keys were found anywhere they might be found
		return undefined;
	}

	return {
		createPullRequestUrl: `${repository.html_url}/pull/new/${branch.name}`,
		id: getJiraId(branch.name),
		issueKeys: allKeys,
		lastCommit: {
			author: getJiraAuthor(branch.target.author, branch.target.history.nodes?.[0]?.author),
			authorTimestamp: branch.target.authoredDate,
			displayId: branch.target.oid.substring(0, 6),
			fileCount: branch.target.changedFiles || 0,
			hash: branch.target.oid,
			id: branch.target.oid,
			// Use only one set of keys for the last commit in order of most specific to least specific
			issueKeys: commitKeys || branchKeys || pullRequestKeys,
			message: branch.target.message,
			url: branch.target.url || undefined,
			updateSequenceId: Date.now()
		},
		name: branch.name,
		url: `${repository.html_url}/tree/${branch.name}`,
		updateSequenceId: Date.now()
	};
}

/**
 * mapCommit takes the a single commit object from the array
 * of commits we got from the GraphQL response and maps the data
 * to the structure needed for the DevInfo API
 */
function mapCommit(commit) {
	const issueKeys = issueKeyParser().parse(commit.message);

	if (isEmpty(issueKeys)) {
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
		message: commit.message,
		timestamp: commit.authoredDate,
		url: commit.url,
		updateSequenceId: Date.now()
	};
}

// TODO: add typings
export default (payload) => {
	// TODO: use reduce instead of map/filter
	const branches = payload.branches
		.map((branch) => mapBranch(branch, payload.repository))
		.filter((branch) => !!branch);

	// TODO: use reduce instead of map/filter
	const commits = payload.branches.flatMap((branch) =>
		branch.target.history.nodes
			.map((commit) => mapCommit(commit))
			.filter((branch) => !!branch)
	);

	if ((!commits || !commits.length) && (!branches || !branches.length)) {
		return undefined;
	}

	return {
		branches,
		commits,
		id: payload.repository.id,
		name: payload.repository.name,
		url: payload.repository.html_url,
		updateSequenceId: Date.now()
	};
};
