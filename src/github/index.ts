import issueComment from "./issue-comment";
import issue from "./issue";
import middleware from "./middleware";
import pullRequest from "./pull-request";
import workflow from "./workflow";
import deployment from "./deployment";
import codeScanningAlert from "./code-scanning-alert";
import push from "./push";
import { createBranch, deleteBranch } from "./branch";
import webhookTimeout from "../middleware/webhook-timeout";
import statsd from "../config/statsd";
import { metricWebhooks } from "../config/metric-names";
import { Application } from "probot";

export default (robot: Application) => {

	// TODO: Need ability to remove these listeners, especially for testing...
	robot.on("*", async (context) => {
		const { name, payload } = context;

		context.log.info({ event: name, action: payload.action, webhookId: context.id }, "Event received");

		const tags = [
			"name: webhooks",
			`event: ${name}`,
			`action: ${payload.action}`
		];

		statsd.increment(metricWebhooks.webhookEvent, tags);
	});

	robot.on(
		["issue_comment.created", "issue_comment.edited"],
		webhookTimeout(middleware(issueComment))
	);

	robot.on(["issues.opened", "issues.edited"], middleware(issue));

	robot.on("push", middleware(push));

	robot.on(
		[
			"pull_request.opened",
			"pull_request.closed",
			"pull_request.reopened",
			"pull_request.edited",
			"pull_request_review"
		],
		middleware(pullRequest)
	);

	robot.on("workflow_run", middleware(workflow));

	robot.on("deployment_status", middleware(deployment));

	robot.on("code_scanning_alert", middleware(codeScanningAlert));

	robot.on("create", middleware(createBranch));
	robot.on("delete", middleware(deleteBranch));
};
