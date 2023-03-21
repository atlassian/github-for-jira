import { processInstallation } from "../sync/installation";
import * as Sentry from "@sentry/node";
import { AxiosErrorEventDecorator } from "models/axios-error-event-decorator";
import { SentryScopeProxy } from "models/sentry-scope-proxy";
import { BackfillMessagePayload, MessageHandler, SQSMessageContext } from "./sqs.types";
import { SQS } from "aws-sdk";

export const backfillQueueMessageHandler =
	(sendSQSBackfillMessage: (message, delaySec, logger) => Promise<SQS.SendMessageResult>): MessageHandler<BackfillMessagePayload> =>
		async (context: SQSMessageContext<BackfillMessagePayload>) => {
			const sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient());
			sentry.configureScope((scope) =>
				scope.addEventProcessor(AxiosErrorEventDecorator.decorate)
			);
			sentry.configureScope((scope) =>
				scope.addEventProcessor(SentryScopeProxy.processEvent)
			);

			const { installationId, jiraHost } = context.payload;
			context.log = context.log.child({
				jiraHost,
				gitHubInstallationId: installationId,
				traceId: Date.now()
			});

			const backfillData = { ...context.payload };

			if (!backfillData.startTime) {
				backfillData.startTime = new Date().toISOString();
			}

			try {
				const processor = await processInstallation(sendSQSBackfillMessage);
				await processor(backfillData, sentry, context.log);
			} catch (err) {
				context.log.warn({ err }, "processInstallation threw a error");

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
