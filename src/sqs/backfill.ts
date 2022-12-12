import { processInstallation } from "../sync/installation";
import * as Sentry from "@sentry/node";
import { AxiosErrorEventDecorator } from "models/axios-error-event-decorator";
import { SentryScopeProxy } from "models/sentry-scope-proxy";
import { BackfillMessagePayload, MessageHandler, SQSMessageContext } from "./sqs.types";

export const backfillQueueMessageHandler: MessageHandler<BackfillMessagePayload> = async (context: SQSMessageContext<BackfillMessagePayload>) => {
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
		gitHubInstallationId: installationId
	});

	const backfillData = { ...context.payload };
	if (!backfillData.startTime) {
		backfillData.startTime = new Date().toISOString();
	}

	try {
		const processor = await processInstallation();
		await processor(backfillData, sentry, context.log);
	} catch (err) {
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
