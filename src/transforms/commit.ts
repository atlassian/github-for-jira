import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../jira/util/isEmpty";
import { JiraCommit, JiraCommitData } from "../interfaces/jira";
import { getJiraAuthor } from "../util/jira";

export const mapCommit = (commit, author): JiraCommit => {

	const issueKeys = issueKeyParser().parse(commit.message);

	if (isEmpty(issueKeys)) {
		return undefined;
	}

	return {
		author: getJiraAuthor(author, commit.author),
		authorTimestamp: commit.authorTimestamp,
		displayId: commit.sha.substring(0, 6),
		fileCount: commit.fileCount,
		hash: commit.sha,
		id: commit.sha,
		issueKeys,
		message: commit.message,
		timestamp: commit.authorTimestamp,
		url: commit.url,
		updateSequenceId: Date.now()
	};
}

// TODO: type payload and return better
export default (payload): JiraCommitData => {
	// TODO: use reduce instead of map/filter combo
	const commits = payload.commits
		.map((commit) => mapCommit(commit, payload.author))
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
