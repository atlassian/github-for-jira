import { MessageHandler, SQSMessageContext, WebhookMessagePayload } from "./sqs.types";
import { createHash, getWebhookSecret, webhookRouter } from "routes/github/webhook/webhook-receiver-post";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { envVars } from "config/env";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "utils/get-github-client-config";

export const webhooksQueueMessageHandler: MessageHandler<WebhookMessagePayload> = async (context: SQSMessageContext<WebhookMessagePayload>): Promise<void> => {
	context.log.debug("Handling webhook from the SQS queue");
	let body: any;
	if (context.payload.body) {
		try {
			body = JSON.parse(context.payload.body);
		} catch (e) {
			context.log.debug(context, "Could not parse body of webhook payload");
		}
	}
	switch (context.payload.event) {
		case "github":
			return await githubWebhookHandler(context, body);
		default:
			context.log.warn(context.payload, "Unknown Webhook event");
	}
};

const githubWebhookHandler = async (context: SQSMessageContext<WebhookMessagePayload>, data: any): Promise<void> => {
	context.log.debug(context, "Github webhook handler");
	try {
		const {
			body,
			header: {
				"x-github-event": eventName,
				"x-hub-signature-256": signature,
				"x-github-delivery": id
			}
		} = context.payload;

		if (!eventName || !signature || !id) {
			context.log.warn("Missing headers for Github webhooks");
			return;
		}

		const uuid = context.payload.path?.proxy;

		context.log = context.log.child({
			githubAppUUID: uuid,
			gitHubDeliveryId: id,
			gitHubEventName: eventName
		});
		context.log.debug("Github Webhook received");
		const { webhookSecret, gitHubServerApp } = await getWebhookSecret(uuid);
		const verification = createHash(body, webhookSecret);

		if (verification !== signature) {
			context.log.warn("Github webhook signature validation failed");
			return;
		}

		const webhookContext = new WebhookContext({
			id: id,
			name: eventName,
			payload: data,
			log: context.log,
			action: data.action,
			gitHubAppConfig: {
				gitHubAppId: gitHubServerApp?.id,
				appId: gitHubServerApp?.appId || parseInt(envVars.APP_ID),
				clientId: gitHubServerApp?.gitHubClientId || envVars.GITHUB_CLIENT_ID,
				gitHubBaseUrl: gitHubServerApp?.gitHubBaseUrl || GITHUB_CLOUD_BASEURL,
				gitHubApiUrl: gitHubServerApp?.gitHubBaseUrl || GITHUB_CLOUD_API_BASEURL,
				uuid
			}
		});
		await webhookRouter(webhookContext);
		context.log.info("Webhook was successfully processed");
	} catch (err) {
		context.log.error(err, "Uncaught error in Github webhooks");
	}
};
