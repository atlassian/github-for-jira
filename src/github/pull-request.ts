import transformPullRequest from "../transforms/pull-request";
import issueKeyParser from "jira-issue-key-parser";

import { Context } from "probot/lib/context";
import { Octokit } from "@octokit/rest";

export default async (context: Context, jiraClient, util): Promise<void> => {

	const {
		pull_request: {
			number: pullRequestNumber
		}, repository: {
			name: repo,
			owner: { login: owner }
		}
	} = context.payload;

	const pullRequest: Octokit.Response<Octokit.PullsGetResponse> = await context.github.pulls.get({
		owner: owner,
		repo: repo,
		pull_number: pullRequestNumber
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let reviews: any = {};
	try {
		reviews = await context.github.pulls.listReviews({
			owner: owner,
			repo: repo,
			pull_number: pullRequestNumber
		});
	} catch (e) {
		context.log.warn(
			{
				err: e,
				payload: context.payload,
				pullRequest: pullRequest.data
			},
			"Missing Github Permissions: Can't retrieve reviewers"
		);
	}

	const jiraPayload = transformPullRequest(
		pullRequest.data,
		reviews.data
	);

	const issueKeys = issueKeyParser().parse(`${pullRequest.data.title}\n${pullRequest.data.head.ref}`);
	/*if (isEmpty(issueKeys)) {
		context.log.info(
			{
				issueKeys,
				payload: context.payload,
				pullRequest: pullRequest.data
			},
			"Deleting pull request association"
		);
		return jiraClient.devinfo.pullRequest.delete(
			pullRequest.data.base.repo.id,
			pullRequest.data.number
		);
	}*/


	try {
		const linkifiedBody = await util.unfurl(pullRequest.data.body);
		if (linkifiedBody) {
			const editedPullRequest = context.issue({
				body: linkifiedBody,
				id: pullRequest.data.id
			});
			await context.github.issues.update(editedPullRequest);
		}
	} catch (err) {
		context.log.warn({ err, body: pullRequest.data.body, pullRequestNumber: pullRequest.data.number }, "Error while trying to update PR body with links to Jira ticket");
	}

	if (!jiraPayload) {
		context.log.debug(
			{ issueKeys, pullRequestNumber: pullRequest.data.number },
			"Halting futher execution for pull request since jiraPayload is empty"
		);
		return;
	}

	context.log({ issueKeys, pullRequestNumber: pullRequest.data.number }, `Sending pull request update to Jira ${jiraClient.baseURL}`);
	await jiraClient.devinfo.repository.update(jiraPayload);
};
