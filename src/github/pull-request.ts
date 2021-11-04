import transformPullRequest from "../transforms/pull-request";
import issueKeyParser from "jira-issue-key-parser";

import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { CustomContext } from "./middleware";
import _ from "lodash";

export default async (
	context: CustomContext,
	jiraClient,
	util
): Promise<void> => {
	const {
		pull_request,
		repository: {
			id: repositoryId,
			name: repo,
			owner: { login: owner },
		},
		changes,
	} = context.payload;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let reviews: any = {};
	try {
		reviews = await context.github.pulls.listReviews({
			owner: owner,
			repo: repo,
			pull_number: pull_request.number,
		});
	} catch (e) {
		context.log.warn(
			{
				err: e,
				payload: context.payload,
				pull_request,
			},
			"Missing Github Permissions: Can't retrieve reviewers"
		);
	}

	const jiraPayload = await transformPullRequest(
		context.github,
		pull_request,
		reviews.data,
		context.log
	);

	const { number: pullRequestNumber, body: pullRequestBody } =  pull_request

	context.log.info({ jiraPayload, pullRequestNumber }, "Pullrequest mapped to Jira Payload");

	// Deletes PR link to jira if ticket id is removed from PR title
	if (!jiraPayload && changes?.title) {
		const issueKeys = issueKeyParser().parse(changes?.title?.from);
		if (!_.isEmpty(issueKeys)) {
			context.log.info(
				{ issueKeys },
				"Sending pullrequest delete event for issue keys"
			);
			await jiraClient.devinfo.pullRequest.delete(
				repositoryId,
				pullRequestNumber
			);
			return;
		}
	}

	try {
		const linkifiedBody = await util.unfurl(pullRequestBody);
		if (linkifiedBody) {
			const editedPullRequest = context.issue({
				body: linkifiedBody,
				id: pull_request.id,
			});
			await context.github.issues.update(editedPullRequest);
		}
	} catch (err) {
		context.log.warn(
			{ err, body: pullRequestBody, pullRequestNumber },
			"Error while trying to update PR body with links to Jira ticket"
		);
	}

	if (!jiraPayload) {
		context.log.info(
			{ pullRequestNumber },
			"Halting futher execution for pull request since jiraPayload is empty"
		);
		return;
	}

	context.log(
		{ pullRequestNumber, jiraPayload },
		`Sending pull request update to Jira ${jiraClient.baseURL}`
	);

	const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status
	);
};
