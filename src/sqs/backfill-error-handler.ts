import { BackfillMessagePayload, ErrorHandler, ErrorHandlingResult, SQSMessageContext } from "~/src/sqs/sqs.types";
import {
	markCurrentTaskAsFailedAndContinue,
	TaskError,
	updateTaskStatusAndContinue
} from "~/src/sync/installation";
import { Task } from "~/src/sync/sync.types";
import { handleUnknownError } from "~/src/sqs/error-handlers";
import Logger from "bunyan";
import { SQS } from "aws-sdk";
import {
	GithubClientInvalidPermissionsError, GithubClientNotFoundError, GithubClientRateLimitingError
} from "~/src/github/client/github-client-errors";

const handleTaskError = async (sendSQSBackfillMessage: (message, delaySec, logger) => Promise<SQS.SendMessageResult>, task: Task, cause: Error, context: SQSMessageContext<BackfillMessagePayload>, rootLogger: Logger
) => {
	const log = rootLogger.child({
		task,
		receiveCount: context.receiveCount,
		lastAttempt: context.lastAttempt
	});
	log.info("Handling error task");

	// TODO: add more task-related logic: e.g. mark as complete for 404; retry on RateLimiting errors etc


	if (cause instanceof GithubClientInvalidPermissionsError) {
		log.warn("InvalidPermissionError: marking the task as failed and continue with the next one");
		await markCurrentTaskAsFailedAndContinue(context.payload, task, true, sendSQSBackfillMessage, log);
		return {
			isFailure: false
		};
	}

	if (cause instanceof GithubClientRateLimitingError) {
		const delayMs = Math.max(cause.rateLimitReset * 1000 - Date.now(), 0);

		// Always schedule a new message: rate-limiting might take long and we
		// don't want to exhaust all retries
		if (delayMs) {
			log.info({ delay: delayMs }, `Delaying job for ${delayMs}ms`);
			await sendSQSBackfillMessage(context.payload, delayMs / 1000, log);
		} else {
			log.info("Rate limit was reset already. Scheduling next task");
			await sendSQSBackfillMessage(context.payload, 0, log);
		}
		return {
			isFailure: false
		};
	}

	if (cause instanceof GithubClientNotFoundError) {
		log.info("Repo was deleted, marking the task as completed");
		await updateTaskStatusAndContinue(context.payload, { edges: [] }, task,  log, sendSQSBackfillMessage);
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
