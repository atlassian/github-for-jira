import { transformWorkflowPayload } from "../transforms/workflow";
import { CustomContext } from "middleware/github-webhook-middleware";
import { emitWebhookProcessedMetrics } from "utils/webhooks";
import { GitHubAppClient } from "./client/github-app-client";
import { getCloudInstallationId } from "./client/installation-id";

export const workflowWebhookHandler = async (context: CustomContext, jiraClient, _util, githubInstallationId: number): Promise<void> => {
	const { payload, log: logger } = context;
	const githubClient = new GitHubAppClient(getCloudInstallationId(githubInstallationId), logger);
	const jiraPayload = await transformWorkflowPayload(githubClient, payload, logger);

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
