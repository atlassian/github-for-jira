import { emitWebhookProcessedMetrics } from "../util/webhooks";

export const deleteRepository = async (context, jiraClient): Promise<void> => {
	context.log(`Deleting dev info for repo ${context.payload.repository?.id}`);

	const jiraResponse = await jiraClient.devinfo.repository.delete(
		context.payload.repository?.id
	);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status
	);
};
