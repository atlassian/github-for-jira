import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformDependabotAlert } from "~/src/transforms/transform-dependabot-alert";
import { JiraClient } from "../jira/client/jira-client";
import { DependabotAlertEvent } from "@octokit/webhooks-types";
import { BooleanFlags, booleanFlag } from "../config/feature-flags";

export const dependabotAlertWebhookHandler = async (context: WebhookContext<DependabotAlertEvent>, jiraClient: JiraClient, _util, gitHubInstallationId: number): Promise<void> => {
	if (!await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraClient.baseURL)) {
		return;
	}
	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost: jiraClient.baseURL
	});

	const jiraPayload = await transformDependabotAlert(context, jiraClient.baseURL);

	if (!jiraPayload) {
		context.log.info({ noop: "no_jira_payload_dependabot_alert" }, "Halting further execution for dependabot alert since jiraPayload is empty");
		return;
	}

	context.log.info(`Sending dependabot alert event as Vulnerability data to Jira's Security endpoint: ${jiraClient.baseURL}`);
	const result = await jiraClient.security.submitVulnerabilities(jiraPayload);
	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;

	const webhookReceived = context.webhookReceived;
	webhookReceived && emitWebhookProcessedMetrics(
		new Date(webhookReceived).getTime(),
		"dependabot_alert",
		jiraClient.baseURL,
		context.log,
		result.status,
		gitHubAppId
	);
};
