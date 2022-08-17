import { JiraClientError } from "../jira/client/axios";
import { Octokit } from "@octokit/rest";
import { emitWebhookFailedMetrics } from "utils/webhook-utils";
import { ErrorHandler, ErrorHandlingResult, SQSMessageContext } from "./sqs.types";
import { RateLimitingError } from "../github/client/github-client-errors";

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


export const jiraAndGitHubErrorsHandler: ErrorHandler<unknown> = async (error: JiraClientError | Octokit.HookError | RateLimitingError | Error,
	context: SQSMessageContext<unknown>): Promise<ErrorHandlingResult> => {

	const maybeResult = maybeHandleNonFailureCase(error, context)
		|| maybeHandleRateLimitingError(error)
		|| maybeHandleNonRetryableResponseCode(error, context);

	if (maybeResult) {
		return maybeResult;
	}

	//In case if error is unknown we should use exponential backoff
	const delaySec = EXPONENTIAL_BACKOFF_BASE_SEC * Math.pow(EXPONENTIAL_BACKOFF_MULTIPLIER, context.receiveCount);
	return { retryable: true, retryDelaySec: delaySec, isFailure: true };
};


/**
 * Error handler which sents failed webhook metric if the retry limit is reached
 */
export function webhookMetricWrapper(delegate: ErrorHandler<any>, webhookName: string) {
	return async (error, context) => {
		const errorHandlingResult = await delegate(error, context);

		if (errorHandlingResult.isFailure && (!errorHandlingResult.retryable || context.lastAttempt)) {
			context.log.error({ error }, `${webhookName} webhook processing failed and won't be retried anymore`);
			emitWebhookFailedMetrics(webhookName);
		}

		return errorHandlingResult;
	};
}

const maybeHandleNonFailureCase = (error: Error, context: SQSMessageContext<unknown>): ErrorHandlingResult | undefined => {
	if (error instanceof JiraClientError &&
		error.status &&
		UNRETRYABLE_STATUS_CODES.includes(error.status)) {
		context.log.warn(`Received ${error.status} from Jira. Unretryable. Discarding the message`);
		return { retryable: false, isFailure: false };
	}

	return undefined;
};

const maybeHandleNonRetryableResponseCode = (error: Error, context: SQSMessageContext<unknown>): ErrorHandlingResult | undefined => {
	//If error is Octokit.HookError or GithubClientError, then we need to check the response status
	//Unfortunately we can't check if error is instance of Octokit.HookError because it is not a calss, so we'll just rely on status
	//New GitHub Client error (GithubClientError) also has status parameter, so it will be covered by the following check too
	//TODO When we get rid of Octokit completely add check if (error instanceof GithubClientError) before the following code
	const maybeErrorWithStatus: any = error;
	if (maybeErrorWithStatus.status && UNRETRYABLE_STATUS_CODES.includes(maybeErrorWithStatus.status)) {
		context.log.warn({ err: maybeErrorWithStatus }, `Received error with ${maybeErrorWithStatus.status} status. Unretryable. Discarding the message`);
		return { retryable: false, isFailure: false };
	}
	return undefined;
};

function maybeHandleRateLimitingError(error: Error): ErrorHandlingResult | undefined {
	if (error instanceof RateLimitingError) {
		const delaySec = error.rateLimitReset + RATE_LIMITING_DELAY_BUFFER_SEC - (Date.now() / 1000);
		return { retryable: true, retryDelaySec: delaySec, isFailure: true };
	}

	return undefined;
}
