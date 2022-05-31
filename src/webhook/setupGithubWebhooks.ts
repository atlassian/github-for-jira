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
		(context: WebhookContext) => {
			context.log.info("issue_comment created/edited event received ", context.id)
		});

	webhooks.on(
		"issue_comment",
		(context: WebhookContext) => {
			context.log.info("issue_comment event received ", context.id);
		});
	webhooks.on("push", (context: WebhookContext) => {
		context.log.info("push event received", context.id)
	});
};