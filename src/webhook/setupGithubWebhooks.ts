import { issueCommentWebhookHandler } from "./issue-comment";
import { issueWebhookHandler } from "./issue";
import { GithubWebhookMiddleware } from "middleware/github-webhook-middleware";
import { pullRequestWebhookHandler } from "./pull-request";
import { workflowWebhookHandler } from "./workflow";
import { WebhookEvent } from "./types";
import { Webhooks } from "./webhooks";

export const setupGithubWebhooks = (webhooks: Webhooks) => {
	webhooks.on(
		[
			"issue_comment.created",
			"issue_comment.edited"
		],
		(event: WebhookEvent) => {
			console.log("issue_comment created and edited ", event.id)
		});

	webhooks.on(
		"issue_comment",
		(event: WebhookEvent) => {
			console.log("issue_comment only ", event.id);
		})
};