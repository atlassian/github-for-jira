/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Sentry from "@sentry/node";

import { AxiosErrorEventDecorator } from "models/axios-error-event-decorator";
import { SentryScopeProxy } from "models/sentry-scope-proxy";
import { Subscription } from "models/subscription";
import { getJiraClient } from "../jira/client/jira-client";
import { getJiraUtil } from "../jira/util/jira-client-util";
// import { enhanceOctokit } from "config/enhance-octokit";
import { Context } from "probot/lib/context";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { emitWebhookFailedMetrics, emitWebhookPayloadMetrics, getCurrentTime } from "utils/webhook-utils";
import { statsd } from "config/statsd";
import { metricWebhooks } from "config/metric-names";
//import { WebhookContext } from "../webhook/types";

const warnOnErrorCodes = ["401", "403", "404"];

// Returns an async function that reports errors errors to Sentry.
// This works similar to Sentry.withScope but works in an async context.
// A new Sentry hub is assigned to context.sentry and can be used later to add context to the error message.
const withSentry = function (callback) {
	return async (context) => {
		context.sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient());
		context.sentry?.configureScope((scope) =>
			scope.addEventProcessor(AxiosErrorEventDecorator.decorate)
		);
		context.sentry?.configureScope((scope) =>
			scope.addEventProcessor(SentryScopeProxy.processEvent)
		);

		try {
			await callback(context);
		} catch (err) {
			context.log.error({ err, context }, "Error while processing webhook");
			emitWebhookFailedMetrics(extractWebhookEventNameFromContext(context));
			context.sentry?.captureException(err);
			throw err;
		}
	};
};

// TODO: We really should fix this...
const isFromIgnoredRepo = (payload) =>
	// These point back to a repository for an installation that
	// is generating an unusually high number of push events. This
	// disables it temporarily. See https://github.com/github/integrations-jira-internal/issues/24.
	//
	// GitHub Apps install: https://admin.github.com/stafftools/users/seequent/installations/491520
	// Repository: https://admin.github.com/stafftools/repositories/seequent/lf_github_testing
	payload.installation?.id === 491520 && payload.repository?.id === 205972230;

const isStateChangeOrDeploymentAction = (action) =>
	["opened", "closed", "reopened", "deployment", "deployment_status"].includes(
		action
	);

/* export class CustomContext extends Context {
	sentry?: Sentry.Hub;
	timedout?: number;
	webhookReceived?: number;
} */

export class CustomContext<E = any> extends Context<E> {
	sentry?: Sentry.Hub;
	timedout?: number;
	webhookReceived?: number;
}

function extractWebhookEventNameFromContext(context: CustomContext): string {
	let webhookEvent = context.name;
	if (context.payload?.action) {
		webhookEvent = `${webhookEvent}.${context.payload.action}`;
	}
	return webhookEvent;
}

// TODO: fix typings
export const GithubWebhookMiddleware = (
	callback: (context: CustomContext, jiraClient: any, util: any, githubInstallationId: number) => Promise<void>
) => {
	return withSentry(async (context: CustomContext) => {
		//enhanceOctokit(context.github);
		const webhookEvent = extractWebhookEventNameFromContext(context);

		// Metrics for webhook payload size
		emitWebhookPayloadMetrics(webhookEvent,
			Buffer.byteLength(JSON.stringify(context.payload), "utf-8"));

		const webhookReceived = getCurrentTime();
		context.webhookReceived = webhookReceived;
		context.sentry?.setExtra("GitHub Payload", {
			event: webhookEvent,
			action: context.payload?.action,
			id: context.id,
			repo: context.payload?.repository ? context.repo() : undefined,
			payload: context.payload,
			webhookReceived
		});

		const { name, payload, id: webhookId } = context;
		const repoName = payload?.repository?.name || "none";
		const orgName = payload?.repository?.owner?.login || "none";
		//const gitHubInstallationId = Number(payload?.installation?.id);
		payload.installation.id = 25427686;
		const gitHubInstallationId = 25427686;

		context.log = context.log.child({
			name: "github.webhooks",
			webhookId,
			gitHubInstallationId,
			event: webhookEvent,
			webhookReceived,
			repoName,
			orgName
		});
		context.log.debug({ payload }, "Webhook payload");

		statsd.increment(metricWebhooks.webhookEvent, [
			"name: webhooks",
			`event: ${name}`,
			`action: ${payload.action}`
		]);

		// Edit actions are not allowed because they trigger this Jira integration to write data in GitHub and can trigger events, causing an infinite loop.
		// State change actions are allowed because they're one-time actions, therefore they won’t cause a loop.
		if (
			context.payload?.sender?.type === "Bot" &&
			!isStateChangeOrDeploymentAction(context.payload.action) &&
			!isStateChangeOrDeploymentAction(context.name)
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

		const subscriptions = await Subscription.getAllForInstallation(
			gitHubInstallationId
		);

		if (!subscriptions.length) {
			context.log.info(
				{ noop: "no_subscriptions", orgName: orgName },
				"Halting further execution since no subscriptions were found."
			);
			return;
		}

		context.log.info(
			`Processing event for ${subscriptions.length} jira instances`
		);

		context.sentry?.setTag(
			"transaction",
			`webhook:${context.name}.${context.payload.action}`
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

			if (await booleanFlag(BooleanFlags.MAINTENANCE_MODE, false, jiraHost)) {
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
				context.log
			);
			if (!jiraClient) {
				// Don't call callback if we have no jiraClient
				context.log.error(
					{ jiraHost },
					`No enabled installation found.`
				);
				continue;
			}
			const util = getJiraUtil(jiraClient);

			try {
				await callback(context, jiraClient, util, gitHubInstallationId);
			} catch (err) {
				const isWarning = warnOnErrorCodes.find(code => err.message.includes(code));
				if (!isWarning) {
					context.log.error(
						{ err, jiraHost },
						`Error processing the event`
					);
					emitWebhookFailedMetrics(webhookEvent);
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
