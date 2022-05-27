import { pushWebhookHandler } from "../github/push";
import { GithubWebhookMiddleware } from "../middleware/github-webhook-middleware";
import { WebhookContext } from "./types";
import { Webhooks } from "./webhooks";

export const setupGithubWebhooks = (webhooks: Webhooks) => {
	webhooks.on(
		[
			"issue_comment.created",
			"issue_comment.edited"
		],
		(event: WebhookContext) => {
			console.log("issue_comment created and edited ", event.id)
		});

	webhooks.on(
		"issue_comment",
		(event: WebhookContext) => {
			console.log("issue_comment only ", event.id);
		});
	webhooks.on("push", GithubWebhookMiddleware(pushWebhookHandler));
};