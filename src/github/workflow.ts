import { transformWorkflowPayload } from "../transforms/workflow";
import { CustomContext } from "./middleware";
import { emitWebhookProcessedMetrics } from "../util/webhooks";
import GitHubClient from "./client/github-client";
import { getCloudInstallationId } from "./client/installation-id";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

export const workflowWebhookHandler = async (context: CustomContext, jiraClient, _util, githubInstallationId: number): Promise<void> => {
	const { github, payload, log: logger } = context;
	const useNewGithubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_WORKFLOW_WEBHOOK, false);
	const githubClient = new GitHubClient(getCloudInstallationId(githubInstallationId), logger);
	const jiraPayload = await transformWorkflowPayload(useNewGithubClient ? githubClient : github, payload, logger);

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
