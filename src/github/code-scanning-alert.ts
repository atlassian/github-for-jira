import { transformCodeScanningAlert } from "../transforms/transform-code-scanning-alert";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { WebhookContext } from "../routes/github/webhook/webhook-context";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

export const codeScanningAlertWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number): Promise<void> => {
	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost: jiraClient.baseURL
	});
	if (!(await booleanFlag(BooleanFlags.SEND_CODE_SCANNING_ALERTS_AS_REMOTE_LINKS, false, jiraClient.baseUrl))) {
		return;
	}

	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;
	const jiraPayload = await transformCodeScanningAlert(context, gitHubInstallationId, jiraClient.baseUrl);

	if (!jiraPayload) {
		context.log.info({ noop: "no_jira_payload_code_scanning_alert" }, "Halting further execution for code scanning alert since jiraPayload is empty");
		return;
	}

	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

	context.log.info({ jiraHost: jiraClient.baseURL, gitHubProduct }, "Sending code scanning alert event as Remote Link to Jira.");

	const result = await jiraClient.remoteLink.submit(jiraPayload);

	const webhookReceived = context.payload.webhookReceived;
	webhookReceived && emitWebhookProcessedMetrics(
		new Date(webhookReceived).getTime(),
		"code_scanning_alert",
		context.log,
		result?.status,
		gitHubAppId
	);
};
