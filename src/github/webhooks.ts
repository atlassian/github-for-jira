import { issueCommentWebhookHandler } from "./issue-comment";
import { issueWebhookHandler } from "./issue";
import { GithubWebhookMiddleware } from "middleware/github-webhook-middleware";
import { pullRequestWebhookHandler } from "./pull-request";
import { workflowWebhookHandler } from "./workflow";
import { deploymentWebhookHandler } from "./deployment";
import { pushWebhookHandler } from "./push";
import { createBranchWebhookHandler, deleteBranchWebhookHandler } from "./branch";
import { webhookTimeout } from "utils/webhook-timeout";
import { Application } from "probot";
import { deleteRepositoryWebhookHandler } from "./repository";
import { codeScanningAlertWebhookHandler } from "~/src/github/code-scanning-alert";
import { convertToWebhookContext } from "../util/convert-to-webhook-context";

export const setupGithubWebhooks = (robot: Application) => {
	robot.on(
		[
			"issue_comment.created",
			"issue_comment.edited",
			"issue_comment.deleted"
		],
		convertToWebhookContext(webhookTimeout(GithubWebhookMiddleware(issueCommentWebhookHandler)))
	);

	robot.on(["issues.opened", "issues.edited"], convertToWebhookContext(GithubWebhookMiddleware(issueWebhookHandler)));

	robot.on("push", convertToWebhookContext(GithubWebhookMiddleware(pushWebhookHandler)));

	robot.on(
		[
			"pull_request.opened",
			"pull_request.closed",
			"pull_request.reopened",
			"pull_request.edited",
			"pull_request_review"
		],
		convertToWebhookContext(GithubWebhookMiddleware(pullRequestWebhookHandler))
	);

	robot.on("workflow_run", convertToWebhookContext(GithubWebhookMiddleware(workflowWebhookHandler)));

	robot.on("deployment_status", convertToWebhookContext(GithubWebhookMiddleware(deploymentWebhookHandler)));

	robot.on("create", convertToWebhookContext(GithubWebhookMiddleware(createBranchWebhookHandler)));
	robot.on("delete", convertToWebhookContext(GithubWebhookMiddleware(deleteBranchWebhookHandler)));

	robot.on("repository.deleted", convertToWebhookContext(GithubWebhookMiddleware(deleteRepositoryWebhookHandler)));

	robot.on("code_scanning_alert", convertToWebhookContext(GithubWebhookMiddleware(codeScanningAlertWebhookHandler)));
};
