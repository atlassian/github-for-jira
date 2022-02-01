import transformWorkflow from "../transforms/workflow";
import { CustomContext } from "./middleware";
import { emitWebhookProcessedMetrics } from "../util/webhooks";

export default async (context: CustomContext, jiraClient): Promise<void> => {
	const { github, payload, log: logger } = context;
	const jiraPayload = await transformWorkflow(github, payload, logger);

	if (!jiraPayload) {
		logger.info(
			{ noop: "no_jira_payload_workflow_run" },
			"Halting further execution for workflow since jiraPayload is empty"
		);
		return;
	}

	logger.info(`Sending workflow event to Jira: ${jiraClient.baseURL}`);

	const jiraResponse = await jiraClient.workflow.submit(jiraPayload);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status
	);
};
