/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Sentry from "@sentry/node";

import { AxiosErrorEventDecorator } from "models/axios-error-event-decorator";
import { SentryScopeProxy } from "models/sentry-scope-proxy";
import { Subscription } from "models/subscription";
import { getJiraClient } from "../jira/client/jira-client";
import { getJiraUtil } from "../jira/util/jira-client-util";
import { booleanFlag, BooleanFlags, stringFlag, StringFlags } from "config/feature-flags";
import { emitWebhookFailedMetrics, emitWebhookPayloadMetrics, getCurrentTime } from "utils/webhook-utils";
import { statsd } from "config/statsd";
import { metricWebhooks } from "config/metric-names";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { defaultLogLevel, getLogger } from "config/logger";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

const warnOnErrorCodes = ["401", "403", "404"];

export const LOGGER_NAME = "github.webhooks";

// Returns an async function that reports errors errors to Sentry.
// This works similar to Sentry.withScope but works in an async context.
// A new Sentry hub is assigned to context.sentry and can be used later to add context to the error message.
const withSentry = function(callback: (context: WebhookContext<{ action?: string }>) => Promise<void>) {
	return async (context: WebhookContext<{ action?: string }>) => {
		context.sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient());
		context.sentry?.configureScope((scope) =>
			scope.addEventProcessor((event, hint) => AxiosErrorEventDecorator.decorate(event, hint))
		);
		context.sentry?.configureScope((scope) =>
			scope.addEventProcessor((event, hint) => SentryScopeProxy.processEvent(event, hint))
		);

		try {
			await callback(context);
		} catch (err: unknown) {
			context.log.error({ err, context }, "Error while processing webhook");
			emitWebhookFailedMetrics(extractWebhookEventNameFromContext(context), undefined);
			context.sentry?.captureException(err);
			throw err;
		}
	};
};

// TODO: We really should fix this...
const isFromIgnoredRepo = (payload: {
	installation?: { id?: number };
	repository?: { id?: number };
}) =>
	// These point back to a repository for an installation that
	// is generating an unusually high number of push events. This
	// disables it temporarily. See https://github.com/github/integrations-jira-internal/issues/24.
	//
	// GitHub Apps install: https://admin.github.com/stafftools/users/seequent/installations/491520
	// Repository: https://admin.github.com/stafftools/repositories/seequent/lf_github_testing
	payload.installation?.id === 491520 && payload.repository?.id === 205972230;

const isStateChangeBranchCreateOrDeploymentAction = (action: string) =>
	["opened", "closed", "reopened", "deployment", "deployment_status", "create"].includes(
		action
	);

const extractWebhookEventNameFromContext = (context: WebhookContext<{ action?: string }>): string => {
	let webhookEvent = context.name;
	if (context.payload?.action) {
		webhookEvent = `${webhookEvent}.${context.payload.action}`;
	}
	return webhookEvent;
};

const moreWebhookSpecificTags = (webhookContext: WebhookContext<{ deployment_status?: { state?: string } }>): Record<string, string | undefined> => {
	if (webhookContext.name === "deployment_status") {
		return {
			deploymentStatusState: webhookContext.payload?.deployment_status?.state
		};
	}
	return {};
};

// TODO: fix typings
export const GithubWebhookMiddleware = (
	callback: (webhookContext: WebhookContext, jiraClient: any, util: any, githubInstallationId: number, subscription: Subscription) => Promise<void>
) => {
	return withSentry(async (context: WebhookContext<
	{
		installation?: { id?: number };
		repository?: { id?: number, name?: string, owner?: { login?: string } };
		sender?: { type?: string; id?: number; login?: string };
		action?: string;
		deployment_status?: { state?: string };
	}>): Promise<void> => {
		const webhookEvent = extractWebhookEventNameFromContext(context);

		// Metrics for webhook payload size
		emitWebhookPayloadMetrics(webhookEvent, undefined,
			Buffer.byteLength(JSON.stringify(context.payload), "utf-8"));

		const webhookReceived = getCurrentTime();
		context.webhookReceived = webhookReceived;
		context.sentry?.setExtra("GitHub Payload", {
			event: webhookEvent,
			action: context.payload?.action,
			id: context.id,
			repo: context.payload?.repository ? {
				owner: context.payload.repository?.owner?.login,
				repo: context.payload.repository.name
			} : undefined,
			payload: context.payload,
			webhookReceived
		});

		const { name, payload, id: webhookId } = context;
		const repoName = payload?.repository?.name || "none";
		const orgName = payload?.repository?.owner?.login || "none";
		if (!payload?.installation?.id) {
			context.log.info("Halting further execution since no installation id found.");
			return;
		}
		const gitHubInstallationId = Number(payload?.installation?.id);
		const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;

		const subscriptions = await Subscription.getAllForInstallation(gitHubInstallationId, gitHubAppId);
		const jiraHost = subscriptions.length ? subscriptions[0].jiraHost : undefined;
		context.log = getLogger(LOGGER_NAME, {
			level: await stringFlag(StringFlags.LOG_LEVEL, defaultLogLevel, jiraHost),
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			fields: {
				webhookId,
				gitHubInstallationId,
				gitHubServerAppIdPk: gitHubAppId?.toString() ?? "undefined",
				event: webhookEvent,
				webhookReceived,
				repoName,
				orgName,
				...context.log.fields
			}
		});

		context.log.info("Processing webhook");

		const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

		const action = String(payload?.action);
		statsd.increment(metricWebhooks.webhookEvent, {
			name: "webhooks",
			event: name,
			action: action,
			gitHubProduct,
			...moreWebhookSpecificTags(context)
		}, { jiraHost });

		// Edit actions are not allowed because they trigger this Jira integration to write data in GitHub and can trigger events, causing an infinite loop.
		// State change actions are allowed because they're one-time actions, therefore they won’t cause a loop.
		if (
			context.payload?.sender?.type === "Bot" &&
			!isStateChangeBranchCreateOrDeploymentAction(action) &&
			!isStateChangeBranchCreateOrDeploymentAction(context.name)
		) {
			context.log.info(
				{
					noop: "bot",
					botId: context.payload?.sender?.id,
					botLogin: context.payload?.sender?.login
				},
				"Halting further execution since the sender is a bot and action is not a state change nor a deployment"
			);
			return;
		}

		if (isFromIgnoredRepo(context.payload)) {
			context.log.info(
				{
					installation_id: context.payload?.installation?.id,
					repository_id: context.payload?.repository?.id
				},
				"Halting further execution since the repository is explicitly ignored"
			);
			return;
		}

		if (!subscriptions.length) {
			context.log.info(
				{ noop: "no_subscriptions", orgName: orgName },
				"Halting further execution since no subscriptions were found."
			);
			return;
		}

		context.log.info(
			{ gitHubProduct },
			`Processing event for ${subscriptions.length} jira instances`
		);

		context.sentry?.setTag(
			"transaction",
			`webhook:${context.name}.${context.payload?.action as string}`
		);

		for (const subscription of subscriptions) {
			const { jiraHost } = subscription;
			context.sentry?.setTag("jiraHost", jiraHost);
			context.sentry?.setTag(
				"gitHubInstallationId",
				gitHubInstallationId.toString()
			);
			context.sentry?.setUser({ jiraHost, gitHubInstallationId });
			context.log = context.log.child({ jiraHost });
			context.log.info("Processing event for Jira Host");

			if (await booleanFlag(BooleanFlags.MAINTENANCE_MODE, jiraHost)) {
				context.log.info(
					{ jiraHost, webhookEvent },
					`Maintenance mode ENABLED - Ignoring event`
				);
				continue;
			}

			if (context.timedout) {
				Sentry.captureMessage(
					"Timed out jira middleware iterating subscriptions"
				);
				context.log.error(
					{
						timeout: true,
						timeoutElapsed: context.timedout
					},
					`Timing out at after ${context.timedout}ms`
				);
				continue;
			}

			const jiraClient = await getJiraClient(
				jiraHost,
				gitHubInstallationId,
				context.gitHubAppConfig?.gitHubAppId,
				context.log
			);

			if (!jiraClient) {
				// Don't call callback if we have no jiraClient
				context.log.warn(
					{ jiraHost },
					`No installations found.`
				);
				continue;
			}
			const util = getJiraUtil(jiraClient);

			try {
				await callback(context, jiraClient, util, gitHubInstallationId, subscription);
			} catch (e: unknown) {
				const err = e as { message?: string };
				const isWarning = warnOnErrorCodes.find(code => err.message?.includes(code));
				if (!isWarning) {
					context.log.error(
						{ err, jiraHost },
						`Error processing the event`
					);
					emitWebhookFailedMetrics(webhookEvent, jiraHost);
					context.sentry?.captureException(err);
				} else {
					context.log.warn(
						{ err, jiraHost },
						`Warning: failed to process event`
					);
				}
			}
		}
	});
};
