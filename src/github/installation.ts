import { WebhookContext } from "routes/github/webhook/webhook-context";
import { JiraClient } from "../jira/client/jira-client";
import { BooleanFlags, booleanFlag } from "../config/feature-flags";
import { InstallationEvent } from "@octokit/webhooks-types";
import { Subscription } from "../models/subscription";
import { submitSecurityWorkspaceToLink } from "../services/subscription-installation-service";
import { Installation } from "../models/installation";
import { emitWebhookProcessedMetrics } from "../util/webhook-utils";
import Logger from "bunyan";

const SECURITY_PERMISSIONS = ["secret_scanning_alerts", "security_events", "vulnerability_alerts"];

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
		payload: {
			installation: {
				permissions
			}
		},
		gitHubAppConfig: {
			gitHubAppId
		}
	} = context;

	const jiraHost = jiraClient.baseURL;

	const logger = context.log.child({
		gitHubInstallationId,
		jiraHost
	});

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
		if (action === "created" && hasSecurityPermissions(permissions)) {
			return await setSecurityPermissionAccepted(subscription, logger);

		} else if (action === "new_permissions_accepted" && hasSecurityPermissions(permissions) && !subscription.isSecurityPermissionsAccepted) {
			await setSecurityPermissionAccepted(subscription, logger);

			jiraResponse = await submitSecurityWorkspaceToLink(installation, subscription, logger);
			logger.info({ subscriptionId: subscription.id }, "Linked security workspace");
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
		logger.warn({ err }, "Failed to submit security workspace to Jira");
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

const hasSecurityPermissions = (permissions: InstallationEvent["installation"]["permissions"]) => {
	return SECURITY_PERMISSIONS.every(securityPermission => securityPermission in permissions);
};

const setSecurityPermissionAccepted = async (subscription: Subscription, logger: Logger) => {
	try {
		if (subscription) {
			await subscription.update({ isSecurityPermissionsAccepted: true });
		}
	} catch (err) {
		logger.warn({ err }, "Failed to set security permissions accepted field in Subscriptions");
	}
};