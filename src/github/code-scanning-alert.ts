import {
	transformCodeScanningAlert,
	transformCodeScanningAlertToJiraSecurity
} from "../transforms/transform-code-scanning-alert";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { WebhookContext } from "../routes/github/webhook/webhook-context";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export const codeScanningAlertWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number): Promise<void> => {
	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost: jiraClient.baseURL
	});

	const jiraPayload = await transformCodeScanningAlert(context, gitHubInstallationId, jiraClient.baseUrl);

	if (!jiraPayload) {
		context.log.info({ noop: "no_jira_payload_code_scanning_alert" }, "Halting further execution for code scanning alert since jiraPayload is empty");
		return;
	}

	context.log.info(`Sending code scanning alert event as Remote Link to Jira: ${jiraClient.baseURL}`);
	const result = await jiraClient.remoteLink.submit(jiraPayload);
	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;

	const webhookReceived = context.webhookReceived;
	webhookReceived && emitWebhookProcessedMetrics(
		new Date(webhookReceived).getTime(),
		"code_scanning_alert",
		jiraClient.baseURL,
		context.log,
		result?.status,
		gitHubAppId
	);
};

export const codeScanningAlertSecurityWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number): Promise<void> => {
	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost: jiraClient.baseURL
	});

	if (!await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraClient.baseURL)) {
		return;
	}

	const jiraPayload = await transformCodeScanningAlertToJiraSecurity(context, gitHubInstallationId, jiraClient.baseURL);

	if (!jiraPayload) {
		context.log.info({ noop: "no_jira_security_payload_code_scanning_alert" }, "Halting further execution for code scanning alert since jiraPayload is empty");
		return;
	}

	context.log.info(`Sending code scanning alert event as Security Vulnerability to Jira: ${jiraClient.baseURL}`);
	const result = await jiraClient.security.submitVulnerabilities(jiraPayload);

	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;

	const webhookReceived = context.payload.webhookReceived;
	webhookReceived && emitWebhookProcessedMetrics(
		new Date(webhookReceived).getTime(),
		"code_scanning_alert_security",
		jiraClient.baseURL,
		context.log,
		result?.status,
		gitHubAppId
	);
};
