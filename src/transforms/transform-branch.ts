import { getJiraId } from "../jira/util/id";
import { getJiraAuthor, jiraIssueKeyParser, limitCommitMessage } from "utils/jira-utils";
import { isEmpty } from "lodash";
import { WebhookPayloadCreate } from "@octokit/webhooks";
import { generateCreatePullRequestUrl } from "./util/pull-request-link-generator";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { JiraBranchData, JiraCommit } from "src/interfaces/jira";

const getLastCommit = async (github: GitHubInstallationClient, webhookPayload: WebhookPayloadCreate, issueKeys: string[]): Promise<JiraCommit> => {
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

export const transformBranch = async (github: GitHubInstallationClient, webhookPayload: WebhookPayloadCreate): Promise<JiraBranchData | undefined> => {
	if (webhookPayload.ref_type !== "branch") {
		return;
	}

	const { ref, repository } = webhookPayload;
	const issueKeys = jiraIssueKeyParser(ref);

	if (isEmpty(issueKeys)) {
		return;
	}

	try {
		const lastCommit = await getLastCommit(github, webhookPayload, issueKeys);
		return {
			id: repository.id.toString(),
			name: repository.full_name,
			url: repository.html_url,
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
			],
			updateSequenceId: Date.now()
		};
	} catch (e) {
		return;
	}
};
