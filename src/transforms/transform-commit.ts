import { JiraCommit, JiraCommitBulkSubmitData } from "interfaces/jira";
import { getJiraAuthor, jiraIssueKeyParser, limitCommitMessage } from "utils/jira-utils";
import { isEmpty } from "lodash";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export const mapCommit = (commit, alwaysSend): JiraCommit | undefined => {
	const issueKeys = jiraIssueKeyParser(commit.message);
	if (isEmpty(issueKeys) && !alwaysSend) { // TODO or keep going if backfill FF is on
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
		message: limitCommitMessage(commit.message),
		url: commit.url || undefined, // If blank string, don't send url
		updateSequenceId: Date.now()
	};
};

// TODO: type payload and return better
/**
 *
 * @param payload
 * @param gitHubBaseUrl - can be undefined for Cloud
 */
export const transformCommit = async (payload, gitHubBaseUrl?: string): Promise<JiraCommitBulkSubmitData | undefined> => {
	// TODO: use reduce instead of map/filter combo
	const alwaysSend = await booleanFlag(BooleanFlags.SEND_ALL_COMMITS_BACKFILL, jiraHost);
	const commits = payload.commits
		.map((commit) => mapCommit(commit, alwaysSend))
		.filter((commit) => !!commit);

	if (commits.length === 0) {
		return undefined;
	}

	return {
		... transformRepositoryDevInfoBulk(payload.repository, gitHubBaseUrl),
		commits: commits
	};
};
