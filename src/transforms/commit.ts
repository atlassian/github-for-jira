import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../jira/util/isEmpty";

function mapCommit(githubCommit, author): Commit {

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

interface Commit {
	author: {
		avatar?: string;
		email: string;
		name: string;
		url?: string;
	};
	authorTimestamp: number;
	displayId: string;
	fileCount: number;
	hash: string;
	id: string;
	issueKeys: string[];
	message: string;
	timestamp: number;
	url: string;
	updateSequenceId: number;
}

interface CommitData {
	commits: Commit[];
	id: string;
	name: string;
	url: string;
	updateSequenceId: number;
}

// TODO: type payload and return better
export default (payload, authorMap): CommitData => {
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
