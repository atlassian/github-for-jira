import { enqueuePush } from "../transforms/push";
import { Context } from "probot/lib/context";
import { getCurrentTime } from "utils/webhook-utils";
import { hasJiraIssueKey } from "utils/jira-utils";
import { GitHubPushData } from '../interfaces/github';

export const pushWebhookHandler = async (context: Context, jiraClient): Promise<void> => {
	const webhookReceived = getCurrentTime();

	// Copy the shape of the context object for processing
	// but filter out any commits that don't have issue keys
	// so we don't have to process them.
	const payload: GitHubPushData = {
		webhookId: context.id,
		webhookReceived,
		repository: context.payload?.repository,
		commits: context.payload?.commits?.reduce((acc, commit) => {
			if(hasJiraIssueKey(commit.message)) {
				acc.push(commit);
			}
			return acc;
		}, []),
		installation: context.payload?.installation
	};

	if (!payload.commits?.length) {
		context.log(
			{ noop: "no_commits" },
			"Halting further execution for push since no commits were found for the payload"
		);
		return;
	}

	context.log("Enqueueing push event");
	await enqueuePush(payload, jiraClient.baseURL);
};
