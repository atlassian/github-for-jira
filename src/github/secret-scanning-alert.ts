import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { JiraClient } from "../jira/client/jira-client";
import { InstallationLite, SecretScanningAlert, SecretScanningAlertCreatedEvent, SecretScanningAlertResolvedEvent, SecretScanningAlertRevokedEvent, Repository, Organization } from "@octokit/webhooks-types";
import { transformSecretScanningAlert } from "../transforms/transform-secret-scanning-alert";
import { User } from "@sentry/node";
import { BooleanFlags, booleanFlag } from "../config/feature-flags";
import { createInstallationClient } from "../util/get-github-client-config";

export const secretScanningAlertWebhookHandler = async (context: WebhookContext<SecretScanningAlertEvent>, jiraClient: JiraClient, _util, gitHubInstallationId: number): Promise<void> => {
	if (!await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraClient.baseURL)) {
		return;
	}
	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost: jiraClient.baseURL
	});

	const gitHubAppId = context.gitHubAppConfig.gitHubAppId;
	const metrics = {
		trigger: "webhook",
		subTrigger: "secretScanningAlert"
	};

	const {
		alert: {
			number: alertNumber
		},
		repository: {
			owner,
			name
		}
	} = context.payload;

	const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, jiraClient.baseURL, metrics, context.log, gitHubAppId);

	const { data: secretScanningAlert } = await gitHubInstallationClient.getSecretScanningAlert(alertNumber, owner.login, name);

	if (!secretScanningAlert) {
		context.log.warn({ gitHubInstallationId }, "Failed to fetch secret scanning alert");
		return;
	}

	const jiraPayload = await transformSecretScanningAlert(secretScanningAlert, context.payload.repository, jiraClient.baseURL, gitHubAppId, context.log);

	if (!jiraPayload) {
		context.log.info({ noop: "no_jira_payload_secret_scanning_alert" }, "Halting further execution for secret scanning alert since jiraPayload is empty");
		return;
	}

	context.log.info(`Sending secret scanning alert event as Vulnerability data to Jira's Security endpoint: ${jiraClient.baseURL}`);
	const result = await jiraClient.security.submitVulnerabilities(jiraPayload);

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
