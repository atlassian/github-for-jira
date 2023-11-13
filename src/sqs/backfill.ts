import Logger from "bunyan";
import { processInstallation } from "../sync/installation";
import * as Sentry from "@sentry/node";
import { AxiosErrorEventDecorator } from "models/axios-error-event-decorator";
import { SentryScopeProxy } from "models/sentry-scope-proxy";
import { BackfillMessagePayload, MessageHandler, SQSMessageContext } from "./sqs.types";
import { SQS } from "aws-sdk";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export const backfillQueueMessageHandler =
	(sendSQSBackfillMessage: (message: BackfillMessagePayload, delaySec: number, logger: Logger) => Promise<SQS.SendMessageResult>): MessageHandler<BackfillMessagePayload> =>
		async (context: SQSMessageContext<BackfillMessagePayload>) => {
			const sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient());
			sentry.configureScope((scope) =>
				scope.addEventProcessor((event, hint) => AxiosErrorEventDecorator.decorate(event, hint))
			);
			sentry.configureScope((scope) =>
				scope.addEventProcessor((event, hint) => SentryScopeProxy.processEvent(event, hint))
			);

			const { installationId, jiraHost } = context.payload;
			context.log = context.log.child({
				jiraHost,
				gitHubInstallationId: installationId,
				traceId: Date.now()
			});

			const logAdditionalData = await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost);
			const backfillData = { ...context.payload };

			logAdditionalData && context.log.info({ installationId }, "Backfilling for installationId");

			if (!backfillData.startTime) {
				backfillData.startTime = new Date().toISOString();
			}

			try {
				const processor = processInstallation(sendSQSBackfillMessage);
				await processor(backfillData, sentry, context.log);
			} catch (err: unknown) {
				logAdditionalData ? context.log.warn({ err, installationId }, "processInstallation threw a error")
					: context.log.warn({ err }, "processInstallation threw a error");

				sentry.setExtra("job", {
					id: context.message.MessageId,
					attemptsMade: parseInt(context.message.Attributes?.ApproximateReceiveCount || "1"),
					timestamp: new Date(),
					data: context.payload
				});

				sentry.setTag("jiraHost", context.payload.jiraHost);
				sentry.setTag("queue", "sqs-backfill");
				sentry.captureException(err);

				throw err;
			}
		};
