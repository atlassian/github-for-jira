import { getJiraId } from "../jira/util/id";
import { getJiraAuthor, jiraIssueKeyParser, limitCommitMessage } from "utils/jira-utils";
import { isEmpty } from "lodash";
import type { CreateEvent } from "@octokit/webhooks-types";
import { generateCreatePullRequestUrl } from "./util/pull-request-link-generator";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { JiraBranchBulkSubmitData, JiraCommit } from "src/interfaces/jira";
import { getLogger } from "config/logger";
import Logger from "bunyan";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";

const getLastCommit = async (github: GitHubInstallationClient, webhookPayload: CreateEvent, issueKeys: string[]): Promise<JiraCommit> => {
	const { data: { object: { sha } } } = await github.getRef(webhookPayload.repository.owner.login, webhookPayload.repository.name, `heads/${webhookPayload.ref}`);
	const { data: { commit, author, html_url: url } } = await github.getCommit(webhookPayload.repository.owner.login, webhookPayload.repository.name, sha);

	return {
		author: getJiraAuthor(author, commit.author),
		authorTimestamp: commit.author.date,
		displayId: sha.substring(0, 6),
		fileCount: 0,
		hash: sha,
		id: sha,
		issueKeys,
		message: limitCommitMessage(commit.message),
		url,
		updateSequenceId: Date.now()
	};
};

export const transformBranch = async (gitHubInstallationClient: GitHubInstallationClient, webhookPayload: CreateEvent, alwaysSend: boolean, logger: Logger = getLogger("transform-branch")): Promise<JiraBranchBulkSubmitData | undefined> => {
	if (webhookPayload.ref_type !== "branch") {
		return;
	}

	const { ref, repository } = webhookPayload;
	const issueKeys = jiraIssueKeyParser(ref);
	if (isEmpty(issueKeys) && !alwaysSend) {
		return;
	}

	try {
		const lastCommit = await getLastCommit(gitHubInstallationClient, webhookPayload, issueKeys);
		return {
			... transformRepositoryDevInfoBulk(repository, gitHubInstallationClient.baseUrl),
			branches: [
				{
					createPullRequestUrl: generateCreatePullRequestUrl(repository.html_url, ref, issueKeys),
					lastCommit,
					id: getJiraId(ref),
					issueKeys,
					name: ref,
					url: `${repository.html_url}/tree/${ref}`,
					updateSequenceId: Date.now()
				}
			]
		};
	} catch (err: unknown) {
		logger.warn(err, "Could not get latest commit from branch as the branch is not available yet on the API. Retrying later.");
		throw err;
	}
};
