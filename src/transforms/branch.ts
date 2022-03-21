import { getJiraId } from "../jira/util/id";
import issueKeyParser from "jira-issue-key-parser";
import { getJiraAuthor } from "../util/jira";
import { isEmpty } from "lodash";
import { WebhookPayloadCreate } from "@octokit/webhooks";
import { generateCreatePullRequestUrl } from "./util/pullRequestLinkGenerator";
import { GitHubAppClient } from "../github/client/github-app-client";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { JiraBranchData, JiraCommit } from "src/interfaces/jira";

const getLastCommit = async (github: GitHubAppClient, webhookPayload: WebhookPayloadCreate, issueKeys: string[]): Promise<JiraCommit> => {
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
		message: commit.message,
		url,
		updateSequenceId: Date.now()
	};
};

export const transformBranch = async (github: GitHubAppClient, webhookPayload: WebhookPayloadCreate): Promise<JiraBranchData | undefined> => {
	if (webhookPayload.ref_type !== "branch") {
		return;
	}

	const { ref, repository } = webhookPayload;
	const issueKeys = issueKeyParser().parse(ref) || [];

	if (isEmpty(issueKeys)) {
		return;
	}

	const lastCommit = await getLastCommit(github, webhookPayload, issueKeys);
	return {
		id: repository.id,
		name: repository.full_name,
		url: repository.html_url,
		branches: [
			{
				createPullRequestUrl: await booleanFlag(BooleanFlags.USE_NEW_GITHUB_PULL_REQUEST_URL_FORMAT, false)
					? generateCreatePullRequestUrl(repository.html_url, ref, issueKeys) : `${repository.html_url}/pull/new/${ref}`,
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
};
