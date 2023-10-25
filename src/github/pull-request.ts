import { transformPullRequestRest } from "../transforms/transform-pull-request";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { isEmpty } from "lodash";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { JiraPullRequestBulkSubmitData } from "interfaces/jira";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { GitHubIssueData } from "interfaces/github";
import { createInstallationClient } from "utils/get-github-client-config";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { getPullRequestReviews } from "~/src/transforms/util/github-get-pull-request-reviews";
import { Subscription } from "models/subscription";

export const 	pullRequestWebhookHandler = async (context: WebhookContext, jiraClient, util, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {
	const {
		pull_request,
		repository: {
			id: repositoryId,
			name: repoName,
			owner: { login: owner }
		},
		changes
	} = context.payload;

	const { number: pullRequestNumber, id: pullRequestId } = pull_request;
	context.log = context.log.child({
		gitHubInstallationId,
		orgName: owner,
		pullRequestNumber,
		pullRequestId
	});

	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;
	const metrics = {
		trigger: "webhook",
		subTrigger: "pullRequest"
	};
	const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, subscription.jiraHost, metrics, context.log, gitHubAppId);
	const reviews = await getPullRequestReviews(subscription.jiraHost, gitHubInstallationClient, context.payload.repository, pull_request, context.log);

	const jiraPayload: JiraPullRequestBulkSubmitData | undefined = await transformPullRequestRest(gitHubInstallationClient, pull_request, reviews, context.log, subscription.jiraHost);
	context.log.info("Pullrequest mapped to Jira Payload");

	// Deletes PR link to jira if ticket id is removed from PR title
	if (!jiraPayload && changes?.title) {
		const issueKeys = jiraIssueKeyParser(changes?.title?.from);

		if (!isEmpty(issueKeys)) {
			context.log.info(
				{ issueKeys },
				"Sending pullrequest delete event for issue keys"
			);

			await jiraClient.devinfo.pullRequest.delete(
				transformRepositoryId(repositoryId, context.gitHubAppConfig?.gitHubBaseUrl),
				pullRequestNumber
			);

			return;
		}
	}

	try {
		await updateGithubIssues(gitHubInstallationClient, context, util, repoName, owner, pull_request);
	} catch (err: unknown) {
		context.log.warn(
			{ err },
			"Error while trying to update PR body with links to Jira ticket"
		);
	}

	if (!jiraPayload) {
		context.log.info("Halting futher execution for pull request since jiraPayload is empty");
		return;
	}

	context.log.info(`Sending pull request update to Jira`);

	const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		subscription.jiraHost,
		log,
		jiraResponse?.status,
		gitHubAppId
	);
};

const updateGithubIssues = async (github: GitHubInstallationClient, context: WebhookContext, util, repoName, owner, pullRequest) => {
	const linkifiedBody = await util.unfurl(pullRequest.body);

	if (!linkifiedBody) {
		return;
	}

	context.log.info("Updating pull request");

	const updatedPullRequest: GitHubIssueData = {
		body: linkifiedBody,
		owner,
		repo: repoName,
		issue_number: pullRequest.number
	};

	await github.updateIssue(updatedPullRequest);
};

