import { transformWorkflow } from "../transforms/transform-workflow";
import { CustomContext } from "middleware/github-webhook-middleware";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { createInstallationClient } from "utils/get-github-client-config";

export const workflowWebhookHandler = async (context: CustomContext, jiraClient, _util, githubInstallationId: number): Promise<void> => {
	const { payload, log: logger } = context;
	const gitHubInstallationClient = await createInstallationClient(githubInstallationId, jiraClient.baseURL, context.log);
	const jiraPayload = await transformWorkflow(gitHubInstallationClient, payload, logger);

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
