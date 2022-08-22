import { transformWorkflow } from "../transforms/transform-workflow";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { createInstallationClient } from "utils/get-github-client-config";
import { WebhookContext } from "../routes/github/webhook/webhook-context";
import { getRepoConfig } from "services/user-config-service";

export const workflowWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number, subscription): Promise<void> => {
	const { payload, log: logger } = context;
	context.log = context.log.child({
		jiraHost: jiraClient.baseURL,
		gitHubInstallationId
	});

	const userConfig = await getRepoConfig(subscription, payload.repository.id);
	if (payload.action == "requested" && userConfig && userConfig.serviceIds){
		// store associations between payload.workflow_run.id and serviceIds in the database
	}


	const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, jiraClient.baseURL, context.log, context.gitHubAppConfig?.gitHubAppId);
	const jiraPayload = await transformWorkflow(gitHubInstallationClient, payload, logger);

	if (!jiraPayload) {
		logger.info(
			{ noop: "no_jira_payload_workflow_run", payload },
			"Halting further execution for workflow since jiraPayload is empty"
		);
		return;
	}

	logger.info({ jiraHost: jiraClient.baseURL }, `Sending workflow event to Jira`);

	const jiraResponse = await jiraClient.workflow.submit(jiraPayload);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status
	);
};
