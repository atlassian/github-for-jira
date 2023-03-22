import { BackfillMessagePayload, ErrorHandler, ErrorHandlingResult, SQSMessageContext } from "~/src/sqs/sqs.types";
import { markCurrentTaskAsFailedAndContinue, TaskError } from "~/src/sync/installation";
import { Task } from "~/src/sync/sync.types";
import { handleUnknownError } from "~/src/sqs/error-handlers";
import Logger from "bunyan";
import { SQS } from "aws-sdk";
import { InvalidPermissionsError } from "~/src/github/client/github-client-errors";

const handleTaskError = async (sendSQSBackfillMessage: (message, delaySec, logger) => Promise<SQS.SendMessageResult>, task: Task, cause: Error, context: SQSMessageContext<BackfillMessagePayload>, rootLogger: Logger
) => {
	const log = rootLogger.child({
		task,
		receiveCount: context.receiveCount,
		lastAttempt: context.lastAttempt
	});
	log.info("Handling error task");

	// TODO: add more task-related logic: e.g. mark as complete for 404; retry on RateLimiting errors etc


	if (cause instanceof InvalidPermissionsError) {
		log.warn("InvalidPermissionError: marking the task as failed and continue with the next one");
		await markCurrentTaskAsFailedAndContinue(context.payload, task, true, sendSQSBackfillMessage, log);
		return {
			isFailure: false
		};
	}

	if (context.lastAttempt) {
		// Otherwise the sync will be "stuck", not something we want
		log.warn("That was the last attempt: marking the task as failed and continue with the next one");
		await markCurrentTaskAsFailedAndContinue(context.payload, task, false, sendSQSBackfillMessage, log);
		return {
			isFailure: false
		};
	}

	return handleUnknownError(cause, context);
};

export const backfillErrorHandler: (sendSQSBackfillMessage: (message, delaySec, logger) => Promise<SQS.SendMessageResult>) => ErrorHandler<BackfillMessagePayload> =
	(sendSQSBackfillMessage) =>
		async (err: Error, context: SQSMessageContext<BackfillMessagePayload>): Promise<ErrorHandlingResult> => {
			const log = context.log.child({ err });
			log.info("Handling error");

			if (err instanceof TaskError) {
				return await handleTaskError(sendSQSBackfillMessage, err.task, err.cause, context, log);
			}

			return handleUnknownError(err, context);
		};
