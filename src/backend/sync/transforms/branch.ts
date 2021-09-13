import { getJiraId } from "../../../common/id";
import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../../../common/isEmpty";

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
		branch.associatedPullRequestTitle
	);
	const commitKeys = issueKeyParser().parse(branch.lastCommit.message);

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
			author: {
				avatar: branch?.lastCommit?.author?.avatarUrl || undefined,
				name: branch?.lastCommit?.author?.name || undefined
			},
			authorTimestamp: branch.lastCommit.authorTimestamp,
			displayId: branch.lastCommit.sha.substring(0, 6),
			fileCount: branch.lastCommit.fileCount,
			hash: branch.lastCommit.sha,
			id: branch.lastCommit.sha,
			// Use only one set of keys for the last commit in order of most specific to least specific
			issueKeys: commitKeys || branchKeys || pullRequestKeys,
			message: branch.lastCommit.message,
			url: branch.lastCommit.url,
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
		author: {
			avatar: commit.author?.avatarUrl || undefined,
			email: commit.author?.email || undefined,
			name: commit.author?.name || undefined,
			url: commit.author?.user?.url || undefined
		},
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
		branch.commits
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
