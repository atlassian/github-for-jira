import transformDeployment from "../transforms/deployment";
import { calculateProcessingTimeInSeconds } from "../util/webhooks";
import { CustomContext } from "./middleware";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

export default async (context: CustomContext, jiraClient): Promise<void> => {
	const jiraPayload = await transformDeployment(context);

	if (!jiraPayload) {
		context.log(
			{ noop: "no_jira_payload_deployment" },
			"Halting further execution for deployment since jiraPayload is empty"
		);
		return;
	}

	context.log(`Sending deployment info to Jira: ${jiraClient.baseURL}`);

	const jiraResponse = await jiraClient.deployment.submit(jiraPayload);
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
