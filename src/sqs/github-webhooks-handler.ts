import { MessageHandler, SQSMessageContext, WebhookMessagePayload } from "./sqs.types";

export const githubWebhooksQueueMessageHandler: MessageHandler<WebhookMessagePayload> = async (context: SQSMessageContext<WebhookMessagePayload>) => {
	// const { body, headers, query } = context.payload;

	context.log.info({ payload: context.payload }, "Handling github webhook from the SQS queue");

};
