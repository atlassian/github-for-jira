import { emitWebhookProcessedMetrics } from "utils/webhook-utils";

export const deleteRepository = async (context, jiraClient, _util, gitHubInstallationId: number): Promise<void> => {
	context.log = context.log.child({
		jiraHost: jiraClient.baseURL,
		gitHubInstallationId
	});
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
