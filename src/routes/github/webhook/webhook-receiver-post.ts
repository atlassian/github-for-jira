import { BinaryLike, createHmac } from "crypto";
import { Request, Response } from "express";
import { pushWebhookHandler } from "~/src/github/push";
import { GithubWebhookMiddleware, LOGGER_NAME } from "~/src/middleware/github-webhook-middleware";
import { GitHubServerApp } from "models/github-server-app";
import { WebhookContext } from "./webhook-context";
import { webhookTimeout } from "~/src/util/webhook-timeout";
import { issueCommentWebhookHandler } from "~/src/github/issue-comment";
import { issueWebhookHandler } from "~/src/github/issue";
import { envVars } from "~/src/config/env";
import { pullRequestWebhookHandler } from "~/src/github/pull-request";
import { createBranchWebhookHandler, deleteBranchWebhookHandler } from "~/src/github/branch";
import { deleteRepositoryWebhookHandler } from "~/src/github/repository";
import { workflowWebhookHandler } from "~/src/github/workflow";
import { deploymentWebhookHandler } from "~/src/github/deployment";
import { codeScanningAlertWebhookHandler } from "~/src/github/code-scanning-alert";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "utils/get-github-client-config";
import { getLogger } from "config/logger";

const writeDebugLogsForRawBody = (verification: string, signatureSHA256: string, webhookSecret: string, logger, response: Response) => {
	logger.info(`bgvozdev debugging, verification=${verification}`);
	logger.info(`bgvozdev debugging, signatureSHA256=${signatureSHA256}`);

	try {
		const verificationRawBody = createHash(response.locals.rawBodyd, webhookSecret);
		logger.info(`bgvozev debugging, verificationRawBody=${verificationRawBody}`);

		if (verification !== verificationRawBody) {
			logger.info(`bgvozev debugging, verification and verificationRawBody are different!`);
		}

	} catch (err) {
		logger.error({ err }, "bgvozdev debugging, boom");
	}
};

export const WebhookReceiverPost = async (request: Request, response: Response): Promise<void> => {
	const eventName = request.headers["x-github-event"] as string;
	const signatureSHA256 = request.headers["x-hub-signature-256"] as string;
	const id = request.headers["x-github-delivery"] as string;
	const uuid = request.params.uuid;
	const payload = request.body;
	const logger = (request.log || getLogger(LOGGER_NAME)).child({
		paramUuid: uuid,
		xGitHubDelivery: id,
		xGitHubEvent: eventName
	});
	logger.info("Webhook received");
	try {
		const { webhookSecret, gitHubServerApp } = await getWebhookSecret(uuid);
		// JSON.stringify?! :wtf: :susp:
		const verification = createHash(JSON.stringify(payload), webhookSecret);

		writeDebugLogsForRawBody(verification, signatureSHA256, webhookSecret, logger, response);

		if (verification != signatureSHA256) {
			logger.warn("Signature validation failed, returning 400");
			response.status(400).send("signature does not match event payload and secret");
			return;
		}
		const webhookContext = new WebhookContext({
			id: id,
			name: eventName,
			payload: payload,
			log: logger,
			action: payload.action,
			gitHubAppConfig: {
				...(!gitHubServerApp ? {
					gitHubAppId: undefined,
					appId: parseInt(envVars.APP_ID),
					clientId: envVars.GITHUB_CLIENT_ID,
					gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
					gitHubApiUrl: GITHUB_CLOUD_API_BASEURL,
					uuid: undefined
				} : {
					gitHubAppId: gitHubServerApp.id,
					appId: gitHubServerApp.appId,
					clientId: gitHubServerApp.gitHubClientId,
					gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
					gitHubApiUrl: gitHubServerApp.gitHubBaseUrl,
					uuid
				})
			}
		});
		await webhookRouter(webhookContext);
		logger.info("Webhook was successfully processed");
		response.sendStatus(204);

	} catch (err) {
		logger.error({ err }, "Something went wrong, returning 400: " + err.message);
		response.sendStatus(400);
	}
};

const webhookRouter = async (context: WebhookContext) => {
	const VALID_PULL_REQUEST_ACTIONS = ["opened", "reopened", "closed", "edited"];
	switch (context.name) {
		case "push":
			await GithubWebhookMiddleware(pushWebhookHandler)(context);
			break;
		case "issue_comment":
			if (context.action === "created" || context.action === "edited") {
				await webhookTimeout(GithubWebhookMiddleware(issueCommentWebhookHandler))(context);
			}
			break;
		case "issues":
			if (context.action === "opened" || context.action === "edited") {
				await GithubWebhookMiddleware(issueWebhookHandler)(context);
			}
			break;
		case "pull_request":
			if (context.action && VALID_PULL_REQUEST_ACTIONS.includes(context.action)) {
				await GithubWebhookMiddleware(pullRequestWebhookHandler)(context);
			}
			break;
		case "pull_request_review":
			await GithubWebhookMiddleware(pullRequestWebhookHandler)(context);
			break;
		case "create":
			await GithubWebhookMiddleware(createBranchWebhookHandler)(context);
			break;
		case "delete":
			await GithubWebhookMiddleware(deleteBranchWebhookHandler)(context);
			break;
		case "repository":
			if (context.action === "deleted") {
				await GithubWebhookMiddleware(deleteRepositoryWebhookHandler)(context);
			}
			break;
		case "workflow_run":
			await GithubWebhookMiddleware(workflowWebhookHandler)(context);
			break;
		case "deployment_status":
			await GithubWebhookMiddleware(deploymentWebhookHandler)(context);
			break;
		case "code_scanning_alert":
			await GithubWebhookMiddleware(codeScanningAlertWebhookHandler)(context);
			break;
	}
};

export const createHash = (data: BinaryLike, secret: string): string => {
	return `sha256=${createHmac("sha256", secret)
		.update(data)
		.digest("hex")}`;
};

const getWebhookSecret = async (uuid?: string): Promise<{ webhookSecret: string, gitHubServerApp?: GitHubServerApp }> => {
	if (uuid) {
		const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		if (!gitHubServerApp) {
			throw new Error(`GitHub app not found for uuid ${uuid}`);
		}
		const webhookSecret = await gitHubServerApp.getDecryptedWebhookSecret();
		return { webhookSecret, gitHubServerApp };
	}
	if (!envVars.WEBHOOK_SECRET) {
		throw new Error("Environment variable 'WEBHOOK_SECRET' not defined");
	}
	return { webhookSecret: envVars.WEBHOOK_SECRET };
};
