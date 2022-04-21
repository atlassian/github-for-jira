import { JiraCommit, JiraCommitData } from "interfaces/jira";
import { getJiraAuthor, jiraIssueKeyParser } from "utils/jira-utils";
import { isEmpty } from "lodash";
const MAX_COMMIT_LENGTH = 1024;

export const mapCommit = (commit): JiraCommit | undefined => {
	const issueKeys = jiraIssueKeyParser(commit.message);
	if (isEmpty(issueKeys)) {
		return undefined;
	}

	return {
		author: getJiraAuthor(commit.author),
		authorTimestamp: commit.authoredDate,
		displayId: commit.oid.substring(0, 6),
		fileCount: commit.changedFiles || 0,
		hash: commit.oid,
		id: commit.oid,
		issueKeys,
		message: commit?.message?.substr(0, MAX_COMMIT_LENGTH),
		url: commit.url || undefined, // If blank string, don't send url
		updateSequenceId: Date.now()
	};
};

// TODO: type payload and return better
export const transformCommit = (payload): JiraCommitData | undefined => {
	// TODO: use reduce instead of map/filter combo
	const commits = payload.commits
		.map((commit) => mapCommit(commit))
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
