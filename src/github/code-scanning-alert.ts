import { transformCodeScanningAlert } from "../transforms/transform-code-scanning-alert";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { WebhookContext } from "../routes/github/webhook/webhook-context";
import { Subscription } from "models/subscription";

export const codeScanningAlertWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {
	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost: jiraClient.baseURL
	});

	const jiraPayload = await transformCodeScanningAlert(context, gitHubInstallationId, jiraClient.baseUrl, subscription.plainClientKey);

	if (!jiraPayload) {
		context.log.info({ noop: "no_jira_payload_code_scanning_alert" }, "Halting further execution for code scanning alert since jiraPayload is empty");
		return;
	}

	context.log.info(`Sending code scanning alert event as Remote Link to Jira: ${jiraClient.baseURL}`);
	const result = await jiraClient.remoteLink.submit(jiraPayload);
	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;

	const webhookReceived = context.payload.webhookReceived;
	webhookReceived && emitWebhookProcessedMetrics(
		new Date(webhookReceived).getTime(),
		"code_scanning_alert",
		context.log,
		result?.status,
		gitHubAppId
	);
};
