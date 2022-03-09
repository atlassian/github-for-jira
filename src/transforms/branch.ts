import { getJiraId } from "../jira/util/id";
import issueKeyParser from "jira-issue-key-parser";
import { getJiraAuthor } from "../util/jira";
import _ from "lodash";
import { WebhookPayloadCreate } from "@octokit/webhooks";
import { GitHubAPI } from "probot";
import { generateCreatePullRequestUrl } from "./util/pullRequestLinkGenerator";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

async function getLastCommit(github: GitHubAPI, webhookPayload: WebhookPayloadCreate, issueKeys: string[]) {

	const {
		data: { object: { sha } }
	} = await github.git.getRef({
		owner: webhookPayload.repository.owner.login,
		repo: webhookPayload.repository.name,
		ref: `heads/${webhookPayload.ref}`
	});

	const {
		data: { commit, author, html_url: url }
	} = await github.repos.getCommit({
		owner: webhookPayload.repository.owner.login,
		repo: webhookPayload.repository.name,
		ref: sha
	});

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
}

export const transformBranch = async (github: GitHubAPI, webhookPayload: WebhookPayloadCreate) => {
	if (webhookPayload.ref_type !== "branch") return undefined;

	const { ref, repository } = webhookPayload;

	const issueKeys = issueKeyParser().parse(ref) || [];

	if (_.isEmpty(issueKeys)) {
		return undefined;
	}

	const lastCommit = await getLastCommit(github, webhookPayload, issueKeys);
	const newPrUrl = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_PULL_REQUEST_URL_FORMAT, false);

	// TODO: type this return
	return {
		id: repository.id,
		name: repository.full_name,
		url: repository.html_url,
		branches: [
			{
				createPullRequestUrl: newPrUrl ? generateCreatePullRequestUrl(repository.html_url, ref, issueKeys) : `${repository.html_url}/pull/new/${ref}`,
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
