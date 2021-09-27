import { calculateProcessingTimeInSeconds } from "../util/webhooks";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

export const deleteRepository = async (context, jiraClient): Promise<void> => {
	context.log(`Deleting dev info for repo ${context.payload.repository?.id}`);

	const jiraResponse = await jiraClient.devinfo.repository.delete(
		context.payload.repository?.id
	);
	const { webhookReceived, name, log } = context;

	if (
		(await booleanFlag(BooleanFlags.WEBHOOK_RECEIVED_METRICS, false)) &&
		webhookReceived
	) {
		calculateProcessingTimeInSeconds(
			webhookReceived,
			name,
			log,
			jiraResponse?.status
		);
	}
};
