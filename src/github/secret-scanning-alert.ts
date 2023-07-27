import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { JiraClient } from "../jira/client/jira-client";
import { InstallationLite, SecretScanningAlert, SecretScanningAlertCreatedEvent, SecretScanningAlertResolvedEvent, SecretScanningAlertRevokedEvent, Repository, Organization } from "@octokit/webhooks-types";
import { transformSecretScanningAlert } from "../transforms/transform-secret-scanning-alert";
import { User } from "@sentry/node";

export const secretScanningAlertWebhookHandler = async (context: WebhookContext<SecretScanningAlertEvent>, jiraClient: JiraClient, _util, gitHubInstallationId: number): Promise<void> => {
	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost: jiraClient.baseURL
	});

	const jiraPayload = await transformSecretScanningAlert(context, jiraClient.baseURL);

	if (!jiraPayload) {
		context.log.info({ noop: "no_jira_payload_secret_scanning_alert" }, "Halting further execution for secret scanning alert since jiraPayload is empty");
		return;
	}

	context.log.info(`Sending secret scanning alert event as Vulnerability data to Jira's Security endpoint: ${jiraClient.baseURL}`);
	const result = await jiraClient.security.submitVulnerabilities(jiraPayload);
	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;

	const webhookReceived = context.webhookReceived;
	webhookReceived && emitWebhookProcessedMetrics(
		new Date(webhookReceived).getTime(),
		"secret_scanning_alert",
		jiraClient.baseURL,
		context.log,
		result.status,
		gitHubAppId
	);
};

// Due to missing SecretScanningAlert for alert property in SecretScanningAlertReopenedEvent in @octokit/webhooks-types.
// If fixed in future realease, remove the following type
export interface SecretScanningAlertReopenedEvent {
	action: "reopened";
	alert: SecretScanningAlert & {
		number: number;
		secret_type: string;
		resolution: null;
		resolved_by: null;
		resolved_at: null;
	};
	repository: Repository;
	organization?: Organization;
	installation?: InstallationLite;
	sender: User;
}

export type SecretScanningAlertEvent =
	| SecretScanningAlertCreatedEvent
	| SecretScanningAlertReopenedEvent
	| SecretScanningAlertResolvedEvent
	| SecretScanningAlertRevokedEvent;
