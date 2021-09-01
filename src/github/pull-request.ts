import transformPullRequest from "../transforms/pull-request";
import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../jira/util/isEmpty";

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

	if (!jiraPayload && context.payload?.changes?.title) {
		const issueKeys = issueKeyParser().parse(
			context.payload.changes?.title?.from
		);

		if (!isEmpty(issueKeys)) {
			return jiraClient.devinfo.pullRequest.delete(
				context.payload.repository?.id,
				pullRequest.data.number
			);
		}
	}

	const linkifiedBody = await util.unfurl(pullRequest.data.body);
	if (linkifiedBody) {
		const editedPullRequest = context.issue({
			body: linkifiedBody,
			id: pullRequest.data.id
		});
		await context.github.issues.update(editedPullRequest);
	}

	if (!jiraPayload) {
		context.log(
			{ noop: "no_jira_payload_pull_request" },
			"Halting futher execution for pull request since jiraPayload is empty"
		);
		return;
	}

	context.log(`Sending pullrequest update to Jira ${jiraClient.baseURL}`);
	await jiraClient.devinfo.repository.update(jiraPayload);
};
