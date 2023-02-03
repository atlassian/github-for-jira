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

	// const rateLimitResponse = await getRateRateLimitBlahBlah(backfillData, context.log);
	// //move out of function scope
	// const getRateRateLimitBlahBlah =() => {
	// 	createInstallationClient();
	// 	return await client,getRateLimit();
	// 	//https://docs.github.com/en/rest/rate-limit?apiVersion=2022-11-28
	//
	// }
	//
	// const isRateLimitExceedingSoftLimit = async (rateLimitResponse, jiraHost) => {
	// 	const threshold = await NumberFlag(, jiraHost, 100);
	// 	const usedPercentCore = (rateLimitResponse.resources.core.used / rateLimitResponse.resources.core.limit) * 100;
	// 	const usedPercentGraphql = (rateLimitResponse.resources.graphql.used / rateLimitResponse.resources.graphql.limit) * 100;
	// 	return usedPercentCore >= threshold || usedPercentGraphql >= threshold;
	// }
	//
	// // TODO ADD TESTS TO THE BACKFILL TO MAKE SURE OTS SKIPPED DURING RATE LIMIT HIT MODE
	// if (isRateLimitExceedingSoftLimit()) {
	// 	// LOG OUT ALL THE RATELIMIT DATA
	// 	log({ rateLimitResponse }, "backfill rate limit reached");
	// 	await sqsQueues.backfill.sendMessage(backfillData, rateLimitResponse.resetTime, context.log);
	// 	return;
	// }

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
