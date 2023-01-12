import { MessageHandler, SQSMessageContext, WebhookMessagePayload } from "./sqs.types";

export const jiraWebhooksQueueMessageHandler: MessageHandler<WebhookMessagePayload> = async (context: SQSMessageContext<WebhookMessagePayload>) => {
	// const { body, headers, query } = context.payload;

	context.log.info({ payload: context.payload }, "Handling jira webhook from the SQS queue");

};
