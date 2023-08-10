import { WebhookContext } from "routes/github/webhook/webhook-context";
import { JiraClient } from "../jira/client/jira-client";
import { BooleanFlags, booleanFlag } from "../config/feature-flags";
import { InstallationEvent } from "@octokit/webhooks-types";
import { Subscription } from "../models/subscription";
import { submitSecurityWorkspaceToLink } from "../services/subscription-installation-service";
import { Installation } from "../models/installation";
import { emitWebhookProcessedMetrics } from "../util/webhook-utils";
import Logger from "bunyan";
import { findOrStartSync } from "../sync/sync-utils";

const SECURITY_PERMISSIONS = ["secret_scanning_alerts", "security_events", "vulnerability_alerts"];
const SECURITY_EVENTS = ["secret_scanning_alert", "code_scanning_alert", "dependabot_alert"];

export const installationWebhookHandler = async (
	context: WebhookContext<InstallationEvent>,
	jiraClient: JiraClient,
	_util,
	gitHubInstallationId: number
): Promise<void> => {

	if (!await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraClient.baseURL)) {
		return;
	}
	const {
		action,
		log: logger,
		payload: {
			installation: {
				permissions,
				events
			}
		},
		gitHubAppConfig: {
			gitHubAppId
		}
	} = context;

	const jiraHost = jiraClient.baseURL;

	const installation = await Installation.getForHost(jiraHost);
	if (!installation) {
		throw new Error(`Installation not found`);
	}

	const subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId, gitHubAppId);
	if (!subscription) {
		throw new Error(`Subscription not found`);
	}

	let jiraResponse;

	try {
		if (action === "created" && hasSecurityPermissionsAndEvents(permissions, events)) {
			return await setSecurityPermissionAccepted(subscription, logger);

		} else if (action === "new_permissions_accepted" && hasSecurityPermissionsAndEvents(permissions, events) && !subscription.isSecurityPermissionsAccepted) {
			jiraResponse = await submitSecurityWorkspaceToLink(installation, subscription, logger);
			logger.info({ subscriptionId: subscription.id }, "Linked security workspace via backfill");

			await findOrStartSync(subscription, logger, "full", subscription.backfillSince, ["dependabotAlert"], { source: "webhook-security-permissions-accepted" });
			logger.info({ subscriptionId: subscription.id }, "Triggered security backfill successfully");

			await setSecurityPermissionAccepted(subscription, logger);
		}

		const webhookReceived = context.webhookReceived;
		webhookReceived && emitWebhookProcessedMetrics(
			new Date(webhookReceived).getTime(),
			`installation-${action}`,
			jiraClient.baseURL,
			logger,
			jiraResponse?.status,
			gitHubAppId
		);

	} catch (err) {
		logger.warn({ err }, "Failed to submit security workspace to Jira or trigger backfill via backfill");
		const webhookReceived = context.webhookReceived;
		webhookReceived && emitWebhookProcessedMetrics(
			new Date(webhookReceived).getTime(),
			"installation",
			jiraClient.baseURL,
			logger,
			500,
			gitHubAppId
		);
	}
};

const hasSecurityPermissionsAndEvents = (permissions: InstallationEvent["installation"]["permissions"], events: InstallationEvent["installation"]["events"]) => {
	return SECURITY_PERMISSIONS.every(securityPermission => securityPermission in permissions) &&
		SECURITY_EVENTS.every((securityEvent: any) => events.includes(securityEvent));
};

const setSecurityPermissionAccepted = async (subscription: Subscription, logger: Logger) => {
	try {
		await subscription.update({ isSecurityPermissionsAccepted: true });
	} catch (err) {
		logger.warn({ err }, "Failed to set security permissions accepted field in Subscriptions");
	}
};