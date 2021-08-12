import issueComment from "./issue-comment";
import issue from "./issue";
import middleware from "./middleware";
import pullRequest from "./pull-request";
import workflow from "./workflow";
import deployment from "./deployment";
import push from "./push";
import { createBranch, deleteBranch } from "./branch";
import webhookTimeout from "../../middleware/webhook-timeout";
import statsd from "../../config/statsd";
import { getLogger } from "../../config/logger";
import { metricWebhooks } from "../../config/metric-names";

export default (robot) => {
	const logger = getLogger("github.webhooks");

	// TODO: Need ability to remove these listeners, especially for testing...
	robot.on("*", (context) => {
		const { name, payload } = context;

		context.log = logger.child({ id: context.id });

		context.log.info({ event: name, action: payload.action }, "Event received");

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

	robot.on("create", middleware(createBranch));
	robot.on("delete", middleware(deleteBranch));
};
