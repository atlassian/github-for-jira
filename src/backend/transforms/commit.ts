import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../../common/isEmpty";
import { JiraCommit, JiraCommitData } from "./interfaces";

function mapCommit(githubCommit, author): JiraCommit {

	const issueKeys = issueKeyParser().parse(githubCommit.message);

	if (isEmpty(issueKeys)) {
		return undefined;
	}

	return {
		author: {
			avatar: author.avatarUrl || undefined,
			email: author.email,
			name: author.name,
			url: author.user ? author.user.url : undefined
		},
		authorTimestamp: githubCommit.authorTimestamp,
		displayId: githubCommit.sha.substring(0, 6),
		fileCount: githubCommit.fileCount,
		hash: githubCommit.sha,
		id: githubCommit.sha,
		issueKeys,
		message: githubCommit.message,
		timestamp: githubCommit.authorTimestamp,
		url: githubCommit.url,
		updateSequenceId: Date.now()
	};
}

// TODO: type payload and return better
export default (payload, authorMap): JiraCommitData => {
	// TODO: use reduce instead of map/filter combo
	const commits = payload.commits
		.map((commit, index) => mapCommit(commit, authorMap[index]))
		.filter((commit) => !!commit);

	if (commits.length === 0) {
		return undefined;
	}

	return {
		commits: commits,
		id: payload.repository.id,
		name: payload.repository.full_name,
		url: payload.repository.html_url,
		updateSequenceId: Date.now()
	};
};
