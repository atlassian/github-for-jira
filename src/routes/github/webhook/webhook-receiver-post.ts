import { BinaryLike, createHmac } from "crypto";
import { Request, Response } from "express";
import { getLogger } from "~/src/config/logger";
import { pushWebhookHandler } from "~/src/github/push";
import { GithubWebhookMiddleware } from "~/src/middleware/github-webhook-middleware";
import { GitHubServerApp } from "models/github-server-app";
import { WebhookContext } from "./webhook-context";
import { webhookTimeout } from "~/src/util/webhook-timeout";
import { issueCommentWebhookHandler } from "~/src/github/issue-comment";
import { issueWebhookHandler } from "~/src/github/issue";
import { envVars } from "~/src/config/env";
import { pullRequestWebhookHandler } from "~/src/github/pull-request";
import { createBranchWebhookHandler, deleteBranchWebhookHandler } from "~/src/github/branch";
import { deleteRepository } from "~/src/github/repository";
import { workflowWebhookHandler } from "~/src/github/workflow";
import { deploymentWebhookHandler } from "~/src/github/deployment";
import { codeScanningAlertWebhookHandler } from "~/src/github/code-scanning-alert";

export const WebhookReceiverPost = async (request: Request, response: Response): Promise<void> => {
	const logger = getLogger("webhook.receiver");
	const eventName = request.headers["x-github-event"] as string;
	const signatureSHA256 = request.headers["x-hub-signature-256"] as string;
	const id = request.headers["x-github-delivery"] as string;
	const uuid = request.params.uuid;
	const payload = request.body;
	try {
		const webhookSecret = await getWebhookSecret(uuid);
		const verification = createHash(JSON.stringify(payload), webhookSecret);
		if (verification != signatureSHA256) {
			response.status(400).send("signature does not match event payload and secret");
			return;
		}

		const webhookContext = new WebhookContext({
			id: id,
			name: eventName,
			payload: payload,
			log: logger,
			action: payload.action
		});
		webhookRouter(webhookContext);
		response.sendStatus(204);

	} catch (error) {
		response.sendStatus(400);
		logger.error(error);
	}
};

const webhookRouter = (context: WebhookContext) => {
	const VALID_PULL_REQUEST_ACTIONS = ["opened", "reopened", "closed", "edited"];
	switch (context.name) {
		case "push":
			GithubWebhookMiddleware(pushWebhookHandler)(context);
			break;
		case "issue_comment":
			if (context.action === "created" || context.action === "edited") {
				webhookTimeout(GithubWebhookMiddleware(issueCommentWebhookHandler))(context);
			}
			break;
		case "issues":
			if (context.action === "opened" || context.action === "edited") {
				GithubWebhookMiddleware(issueWebhookHandler)(context);
			}
			break;
		case "pull_request":
			if (context.action && VALID_PULL_REQUEST_ACTIONS.includes(context.action)) {
				GithubWebhookMiddleware(pullRequestWebhookHandler)(context);
			}
			break;
		case "pull_request_review":
			GithubWebhookMiddleware(pullRequestWebhookHandler)(context);
			break;
		case "create":
			GithubWebhookMiddleware(createBranchWebhookHandler)(context);
			break;
		case "delete":
			GithubWebhookMiddleware(deleteBranchWebhookHandler)(context);
			break;
		case "repository":
			if (context.action === "deleted") {
				GithubWebhookMiddleware(deleteRepository)(context);
			}
			break;
		case "workflow_run":
			GithubWebhookMiddleware(workflowWebhookHandler)(context);
			break;
		case "deployment_status":
			GithubWebhookMiddleware(deploymentWebhookHandler)(context);
			break;
		case "code_scanning_alert":
			GithubWebhookMiddleware(codeScanningAlertWebhookHandler)(context);
			break;
	}
};

export const createHash = (data: BinaryLike, secret: string): string => {
	return `sha256=${createHmac("sha256", secret)
		.update(data)
		.digest("hex")}`;
};

const getWebhookSecret = async (uuid?: string) => {
	if (uuid) {
		const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		if (!gitHubServerApp) {
			throw new Error(`GitHub app not found for uuid ${uuid}`);
		}
		return await gitHubServerApp.decrypt("webhookSecret");
	}
	if (!envVars.WEBHOOK_SECRET) {
		throw new Error("Environment variable 'WEBHOOK_SECRET' not defined");
	}
	return envVars.WEBHOOK_SECRET;
};
