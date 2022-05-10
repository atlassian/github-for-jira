import { emitWebhookProcessedMetrics } from "utils/webhook-utils";

export const deleteRepository = async (context, jiraClient): Promise<void> => {
	context.log(`Deleting dev info for repo ${context.payload.repository?.id}`);

	const deleteDevinfoPromise = jiraClient.devinfo.repository.delete(
		context.payload.repository?.id
	);

	const deleteDeploymentsPromise = jiraClient.deployment.delete(
		context.payload.repository?.id
	);

	const deleteBuildsPromise = jiraClient.workflow.delete(
		context.payload.repository?.id
	);

	await Promise.all([
		deleteDevinfoPromise,
		deleteBuildsPromise,
		deleteDeploymentsPromise
	]);

	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		202
	);
};
