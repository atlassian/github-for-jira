import { transformCodeScanningAlert } from "../transforms/transform-code-scanning-alert";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { WebhookContext } from "../routes/github/webhook/webhook-context";

export const codeScanningAlertWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number): Promise<void> => {
	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost: jiraClient.baseURL
	});
	if (!(await booleanFlag(BooleanFlags.SEND_CODE_SCANNING_ALERTS_AS_REMOTE_LINKS, false, jiraClient.baseUrl))) {
		return;
	}

	const jiraPayload = await transformCodeScanningAlert(context, gitHubInstallationId, jiraClient.baseUrl);

	if (!jiraPayload) {
		context.log.info({ noop: "no_jira_payload_code_scanning_alert" }, "Halting further execution for code scanning alert since jiraPayload is empty");
		return;
	}

	context.log.info(`Sending code scanning alert event as Remote Link to Jira: ${jiraClient.baseURL}`);
	const result = await jiraClient.remoteLink.submit(jiraPayload);

	const webhookReceived = context.payload.webhookReceived;
	webhookReceived && emitWebhookProcessedMetrics(
		new Date(webhookReceived).getTime(),
		"code_scanning_alert",
		context.log,
		result?.status
	);
};
