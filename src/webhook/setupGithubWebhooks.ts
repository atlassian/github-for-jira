/**
 * This is temporary file and  will be removed once exiting event handlers are hooked-in.
 * 
 */

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
	webhooks.on("push", (event: WebhookContext) => {
		console.log("push event received", event.id)
	});
};