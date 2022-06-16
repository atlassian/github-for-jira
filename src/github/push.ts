import { enqueuePush } from "../transforms/push";
import { getCurrentTime } from "utils/webhook-utils";
import { hasJiraIssueKey } from "utils/jira-utils";
import { GitHubPushData } from "../interfaces/github";
import type { CustomContext } from "../middleware/github-webhook-middleware";
import type { PushEvent } from "@octokit/webhooks-types";

export const pushWebhookHandler = async (context: CustomContext<PushEvent>, jiraClient): Promise<void> => {

	const webhookReceived = getCurrentTime();

	// Copy the shape of the context object for processing
	// but filter out any commits that don't have issue keys
	// so we don't have to process them.
	const payload: GitHubPushData = {
		webhookId: context.id,
		webhookReceived,
		repository: context.payload?.["repository"] as any, //TODO: fix any
		commits: context.payload?.commits?.reduce((acc: string[], commit) => {
			if (hasJiraIssueKey(commit.message)) {
				acc.push(commit.message); //TODO ? Really? Fix it!
			}
			return acc;
		}, []),
		installation: context.payload?.installation as any //TODO: fix any
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
