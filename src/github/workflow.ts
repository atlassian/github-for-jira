import transformWorkflow from "../transforms/workflow";
import { CustomContext } from "./middleware";
import { calculateProcessingTimeInSeconds } from "../util/webhooks";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

export default async (context: CustomContext, jiraClient): Promise<void> => {
	const jiraPayload = transformWorkflow(context);

	if (!jiraPayload) {
		context.log(
			{ noop: "no_jira_payload_workflow_run" },
			"Halting further execution for workflow since jiraPayload is empty"
		);
		return;
	}

	context.log(`Sending workflow event to Jira: ${jiraClient.baseURL}`);

	const jiraResponse = await jiraClient.workflow.submit(jiraPayload);
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
