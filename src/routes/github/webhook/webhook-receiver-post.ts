import { BinaryLike, createHmac } from "crypto";
import { Request, Response } from "express";
import { getLogger } from "~/src/config/logger";
import { GitHubServerApp } from "models/github-server-app";
import { WebhookContext } from "./webhook-context";
import { issueCommentWebhookHandler_new } from "../../../github/issue-comment";
import { getJiraClient } from "../../../jira/client/jira-client";
import { getJiraUtil } from "../../../jira/util/jira-client-util";

import type {
	WebhookEventName,
	WebhookEvent,
	IssueCommentEvent
} from "@octokit/webhooks-types";

export const WebhookReceiverPost = async (request: Request, response: Response): Promise<void> => {
	const logger = getLogger("webhook.receiver");
	const eventName = request.headers["x-github-event"] as WebhookEventName;
	const signatureSHA256 = request.headers["x-hub-signature-256"] as string;
	const id = request.headers["x-github-delivery"] as string;
	const uuid = request.params.uuid;
	const payload = request.body as WebhookEvent;
	let webhookSecret: string;
	try {
		const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		if (!gitHubServerApp) {
			response.status(400).send("GitHub app not found");
			return;
		}
		webhookSecret = gitHubServerApp.webhookSecret;
		const verification = createHash(JSON.stringify(payload), webhookSecret);
		if (verification != signatureSHA256) {
			response.status(400).send("signature does not match event payload and secret");
			return;
		}

		const webhookContext: WebhookContext = {
			id: id,
			name: eventName,
			action: payload["action"],
			payload: payload,
			webhookReceived: Date.now(),
			log: logger
		};

		const jiraClient = await getJiraClient(
			jiraHost,
			payload["installation"]?.id,
			logger
		);
		const util = getJiraUtil(jiraClient);

		webhookRouter(webhookContext, jiraClient, util);

		response.sendStatus(204);

	} catch (error) {
		response.sendStatus(500);
		logger.error(error);
	}
};

//TODO: better typing logger to move away from probot
const webhookRouter = (ctx: WebhookContext, jiraClient: any, util: any) => {
	const { name, action, payload } = ctx;
	const githubInstallationId = payload["installation"]?.id;
	if (name === "issue_comment") {
		if (action === "created") {
			issueCommentWebhookHandler_new(
				ctx as WebhookContext<IssueCommentEvent>, jiraClient, util, githubInstallationId
			);
		}
	}
};

const createHash = (data: BinaryLike, secret: string): string => {
	return `sha256=${createHmac("sha256", secret)
		.update(data)
		.digest("hex")}`;
};
