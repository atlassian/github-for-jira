import transformPullRequest from "../transforms/pull-request";
import issueKeyParser from "jira-issue-key-parser";

import { Context } from "probot/lib/context";
import { isEmpty } from "../jira/util/isEmpty";

export default async (context: Context, jiraClient, util): Promise<void> => {

	const {
		pull_request,
		repository: {
			id: repositoryId,
			name: repo,
			owner: { login: owner }
		},
		changes
	} = context.payload;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let reviews: any = {};
	try {
		reviews = await context.github.pulls.listReviews({
			owner: owner,
			repo: repo,
			pull_number: pull_request.number
		});
	} catch (e) {
		context.log.warn(
			{
				err: e,
				payload: context.payload,
				pull_request
			},
			"Missing Github Permissions: Can't retrieve reviewers"
		);
	}

	const jiraPayload = transformPullRequest(
		pull_request,
		reviews.data,
		context.log
	);

	context.log.info({jiraPayload}, "Pullrequest mapped to Jira Payload")

	// Deletes PR link to jira if ticket id is removed from PR title
	if (!jiraPayload && changes?.title) {
		const issueKeys = issueKeyParser().parse(changes?.title?.from);

		if (!isEmpty(issueKeys)) {
			context.log.info({issueKeys}, "Sending pullrequest delete event for issue keys")
			return jiraClient.devinfo.pullRequest.delete(repositoryId, pull_request.number);
		}
	}

	try {
		const linkifiedBody = await util.unfurl(pull_request.body);
		if (linkifiedBody) {
			const editedPullRequest = context.issue({
				body: linkifiedBody,
				id: pull_request.id
			});
			await context.github.issues.update(editedPullRequest);
		}
	} catch (err) {
		context.log.warn({ err, body: pull_request.body, pullRequestNumber: pull_request.number }, "Error while trying to update PR body with links to Jira ticket");
	}

	if (!jiraPayload) {
		context.log.info(
			{ pullRequestNumber: pull_request.number },
			"Halting futher execution for pull request since jiraPayload is empty"
		);
		return;
	}

	context.log({ pullRequestNumber: pull_request.number, jiraPayload }, `Sending pull request update to Jira ${jiraClient.baseURL}`);
	await jiraClient.devinfo.repository.update(jiraPayload);
};
