import {Context, ErrorHandler, ErrorHandlingResult, MessageHandler} from "./index"
import enhanceOctokit, {RateLimitingError} from "../config/enhance-octokit";
import {processPush} from "../transforms/push";
import app from "../worker/app";
import {wrapLogger} from "probot/lib/wrap-logger";
import {JiraClientError} from "../jira/client/axios";
import { Octokit } from "@octokit/rest";
import {emitWebhookFailedMetrics} from "../util/webhooks";

export type PayloadRepository = {
	id: number,
	name: string,
	full_name: string,
	html_url: string,
	owner: string,
}

export type PushQueueMessagePayload = {
	repository: PayloadRepository,
	shas: { id: string, issueKeys: string[] }[],
	jiraHost: string,
	installationId: number,
	webhookId: string,
	webhookReceived?: Date,
}

export const pushQueueMessageHandler : MessageHandler<PushQueueMessagePayload> = async (context : Context<PushQueueMessagePayload>) => {

	context.log.info("Handling push message from the SQS queue")

	const payload = context.payload;

	let github;
	try {
		github = await app.auth(payload.installationId);
	} catch (err) {
		context.log.warn({ err, payload }, "Could not authenticate for the supplied InstallationId");
		return;
	}
	enhanceOctokit(github);
	await processPush(github, payload, wrapLogger(context.log));
}


const NON_ERRONEOUS_STATUSES = [401, 404, 403];
const RATE_LIMITING_DELAY_BUFFER = 10;
const EXPONENTIAL_BACKOFF_BASE = 60;
export const pushQueueErrorHandler : ErrorHandler<PushQueueMessagePayload> = async (error: JiraClientError | Octokit.HookError | RateLimitingError | Error,
	context: Context<PushQueueMessagePayload>) : Promise<ErrorHandlingResult> => {

	//Handle non-failure cases
	const maybeResult = maybeHandleNonFailureCase(error, context);
	if(maybeResult) {
		return maybeResult;
	}

	//Handle failure cases
	const errorHandlingResult = handleFailureCase(error, context);

	if(!errorHandlingResult.retryable || context.lastAttempt ) {
		//Emit metrics if the failure is not retryable
		context.log.error({error}, "Webhook push processing failed and won't be retried anymore");
		emitWebhookFailedMetrics("push")
	}

	return errorHandlingResult;
}

function maybeHandleNonFailureCase(error: Error, context: Context<PushQueueMessagePayload>): ErrorHandlingResult | undefined {
	if(error instanceof JiraClientError &&
		error.status &&
		NON_ERRONEOUS_STATUSES.includes(error.status)) {
		context.log.warn(`Received ${error.status} from Jira. Unretryable. Discarding the message`);
		return {retryable: false}
	}

	//If error is Octokit.HookError, then we need to check the response status
	//Unfortunately we can't check if error is instance of Octokit.HookError because it is not a calss, so we'll just rely on status
	//TODO Add error handling for the new GitHub client when it will be done
	const maybeErrorWithStatus : any = error;
	if(maybeErrorWithStatus.status && NON_ERRONEOUS_STATUSES.includes(maybeErrorWithStatus.status)) {
		context.log.warn({err: maybeErrorWithStatus}, `Received error with ${maybeErrorWithStatus.status} status. Unretryable. Discarding the message`);
		return {retryable: false}
	}

	return undefined;

}

function handleFailureCase(error: Error, context: Context<PushQueueMessagePayload>): ErrorHandlingResult {
	if (error instanceof RateLimitingError) {
		// delaying until the rate limit is reset (plus a buffer of a couple seconds)
		const delaySec = error.rateLimitReset + RATE_LIMITING_DELAY_BUFFER - (new Date().getTime() / 1000);
		return {retryable: true, retryDelaySec: delaySec}
	}

	//Use exponential backoff in any other case
	const delaySec = EXPONENTIAL_BACKOFF_BASE * Math.pow(3, context.receiveCount);
	return {retryable: true, retryDelaySec: delaySec}
}
