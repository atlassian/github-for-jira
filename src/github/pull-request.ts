import transformPullRequest from "../transforms/pull-request";
import issueKeyParser from "jira-issue-key-parser";

import { Context } from "probot/lib/context";
import { Octokit } from "@octokit/rest";
import { isEmpty } from "../jira/util/isEmpty";

export default async (context: Context, jiraClient, util): Promise<void> => {

	const {
		pull_request: {
			number: pullRequestNumber
		},
		repository: {
			id: repositoryId,
			name: repo,
			owner: { login: owner }
		},
		changes
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

	// Deletes PR link to jira if ticket id is removed from PR title
	if (!jiraPayload && changes?.title) {
		const issueKeys = issueKeyParser().parse(changes?.title?.from);

		if (!isEmpty(issueKeys)) {
			return jiraClient.devinfo.pullRequest.delete(repositoryId, pullRequestNumber);
		}
	}

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
			{ pullRequestNumber: pullRequest.data.number },
			"Halting futher execution for pull request since jiraPayload is empty"
		);
		return;
	}

	context.log({ pullRequestNumber: pullRequest.data.number }, `Sending pull request update to Jira ${jiraClient.baseURL}`);
	await jiraClient.devinfo.repository.update(jiraPayload);
};
