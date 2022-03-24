import { issueCommentWebhookHandler } from "./issue-comment";
import { issueWebhookHandler } from "./issue";
import { GithubWebhookMiddleware } from "middleware/github-webhook-middleware";
import { pullRequestWebhookHandler } from "./pull-request";
import { workflowWebhookHandler } from "./workflow";
import deployment from "./deployment";
import { pushWebhookHandler } from "./push";
import { createBranch, deleteBranch } from "./branch";
import webhookTimeout from "../util/webhook-timeout";
import statsd from "config/statsd";
import { metricWebhooks } from "config/metric-names";
import { Application } from "probot";
import { deleteRepository } from "./repository";

export default (robot: Application) => {
	// TODO: Need ability to remove these listeners, especially for testing...
	robot.on("*", async (context) => {
		const { name, payload, id } = context;

		context.log.info({ event: name, action: payload.action, webhookId: id }, "Event received");

		const tags = [
			"name: webhooks",
			`event: ${name}`,
			`action: ${payload.action}`
		];

		statsd.increment(metricWebhooks.webhookEvent, tags);
	});

	robot.on(
		["issue_comment.created", "issue_comment.edited"],
		webhookTimeout(GithubWebhookMiddleware(issueCommentWebhookHandler))
	);

	robot.on(["issues.opened", "issues.edited"], GithubWebhookMiddleware(issueWebhookHandler));

	robot.on("push", GithubWebhookMiddleware(pushWebhookHandler));

	robot.on(
		[
			"pull_request.opened",
			"pull_request.closed",
			"pull_request.reopened",
			"pull_request.edited",
			"pull_request_review"
		],
		GithubWebhookMiddleware(pullRequestWebhookHandler)
	);

	robot.on("workflow_run", GithubWebhookMiddleware(workflowWebhookHandler));

	robot.on("deployment_status", GithubWebhookMiddleware(deployment));

	robot.on("create", GithubWebhookMiddleware(createBranch));
	robot.on("delete", GithubWebhookMiddleware(deleteBranch));

	robot.on("repository.deleted", GithubWebhookMiddleware(deleteRepository));
};
