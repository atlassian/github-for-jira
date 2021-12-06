import {Context, ErrorHandler, ErrorHandlingResult} from "./index";
import {JiraClientError} from "../jira/client/axios";
import {Octokit} from "@octokit/rest";
import {RateLimitingError as OldRateLimitingError} from "../config/enhance-octokit";
import {emitWebhookFailedMetrics} from "../util/webhooks";
import {PushQueueMessagePayload} from "./push";
import {RateLimitingError} from "../github/client/errors";

/**
 * Sometimes we can get errors from Jira and GitHub which does not indicate a failured webhook. For example:
 *  Jira site is gone, we'll get 404
 *  GitHub App is not installed anymore we'll get 401
 *  etc.
 *
 *  In such cases webhook processing doesn't make sense anymore and we need to silently discard these errors
 */
const UNRETRYABLE_STATUS_CODES = [401, 404, 403];

const RATE_LIMITING_DELAY_BUFFER_SEC = 10;
const EXPONENTIAL_BACKOFF_BASE_SEC = 60;
const EXPONENTIAL_BACKOFF_MULTIPLIER = 3;

export const jiraOctokitErrorHandler : ErrorHandler<any> = async (error: JiraClientError | Octokit.HookError | OldRateLimitingError | RateLimitingError | Error,
	context: Context<any>) : Promise<ErrorHandlingResult> => {

	const maybeResult = maybeHandleNonFailureCase(error, context);
	if (maybeResult) {
		return maybeResult;
	}

	const errorHandlingResult = handleFailureCase(error, context);

	if (!errorHandlingResult.retryable || context.lastAttempt ) {
		context.log.error({error}, "Webhook push processing failed and won't be retried anymore");
		emitWebhookFailedMetrics("push")
	}

	return errorHandlingResult;
}

function maybeHandleNonFailureCase(error: Error, context: Context<PushQueueMessagePayload>): ErrorHandlingResult | undefined {
	if (error instanceof JiraClientError &&
		error.status &&
		UNRETRYABLE_STATUS_CODES.includes(error.status)) {
		context.log.warn(`Received ${error.status} from Jira. Unretryable. Discarding the message`);
		return {retryable: false}
	}

	//If error is Octokit.HookError, then we need to check the response status
	//Unfortunately we can't check if error is instance of Octokit.HookError because it is not a calss, so we'll just rely on status
	//TODO Add error handling for the new GitHub client when it will be done
	const maybeErrorWithStatus : any = error;
	if (maybeErrorWithStatus.status && UNRETRYABLE_STATUS_CODES.includes(maybeErrorWithStatus.status)) {
		context.log.warn({err: maybeErrorWithStatus}, `Received error with ${maybeErrorWithStatus.status} status. Unretryable. Discarding the message`);
		return {retryable: false}
	}

	return undefined;
}

function handleFailureCase(error: Error, context: Context<PushQueueMessagePayload>): ErrorHandlingResult {
	if (error instanceof OldRateLimitingError) {
		const delaySec = error.rateLimitReset + RATE_LIMITING_DELAY_BUFFER_SEC - (new Date().getTime() / 1000);
		return {retryable: true, retryDelaySec: delaySec}
	}

	if (error instanceof RateLimitingError) {
		const delaySec = error.rateLimitReset + RATE_LIMITING_DELAY_BUFFER_SEC - (new Date().getTime() / 1000);
		return {retryable: true, retryDelaySec: delaySec}
	}

	//In case if error is unknown we should use exponential backoff
	const delaySec = EXPONENTIAL_BACKOFF_BASE_SEC * Math.pow(EXPONENTIAL_BACKOFF_MULTIPLIER, context.receiveCount);
	return {retryable: true, retryDelaySec: delaySec}
}
