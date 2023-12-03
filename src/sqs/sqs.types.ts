import type { CreateEvent, DeploymentStatusEvent } from "@octokit/webhooks-types";
import type { TaskType, SyncType } from "~/src/sync/sync.types";
import { Message } from "aws-sdk/clients/sqs";
import Logger from "bunyan";

/**
 * Message processing context, which will be passed to message handler to handle the received message
 */
export type SQSMessageContext<MessagePayload> = {

	/**
	 * Message payload
	 */
	payload: MessagePayload;

	/**
	 * Original SQS Mesage
	 */
	message: Message;

	/**
	 * Context logger, which has parameters for the processing context (like message id, execution id, etc)
	 */
	log: Logger;

	/**
	 * How many times this messages attempted to be processed, including the current attempt (always greater 0)
	 */
	receiveCount: number;


	/**
	 * Indicates if it is the last attempt to process this message
	 */
	lastAttempt: boolean;
}

export type QueueSettings = {

	readonly queueName: string,

	readonly queueUrl: string,

	readonly queueRegion: string,

	readonly longPollingIntervalSec?: number,

	/**
	 * Timeout for processing a single message in seconds.
	 * If non-integer value passed then the timeout will be rounded to the closest integer
	 */
	readonly timeoutSec: number;

	/**
	 * Defines how many times the message can be attempted to be executed
	 */
	readonly maxAttempts: number;

	//TODO Add batching

}

/**
 * Error indicating a timeout
 */
export class SqsTimeoutError extends Error {
}

/**
 * Handler for the queue messages
 */
export type MessageHandler<MessagePayload> = (context: SQSMessageContext<MessagePayload>) => Promise<void>;

export type ErrorHandler<MessagePayload> = (error: Error, context: SQSMessageContext<MessagePayload>) => Promise<ErrorHandlingResult>;

export interface ErrorHandlingResult {
	/**
	 * Indicates if the message should be deleted or retried
	 */
	retryable?: boolean;

	/**
	 * Indicates if the error should be treated like a message processing failure.
	 * If it is set to "false" we consider message being processed successfully.
	 */
	isFailure: boolean;

	/**
	 * Number in seconds of the retry delay
	 */
	retryDelaySec?: number;

	/**
	 * If set to true, the message will be deleted when the maximum amount of retries reacched
	 */
	skipDlq?: boolean;

}

export interface SQSContext {
	/**
	 * Indicates if this listener should stop processing messages.
	 *
	 * If it is "true" the listener won't take new messages for processing, however, it might
	 * still be finishing with the current message.
	 */
	stopped: boolean;
	/**
	 * Indicates if this listener stopped processing messages.
	 *
	 * If it is "false" that mean that the listener was stopped and it is done with its last
	 * message.
	 */
	listenerRunning: boolean;

	/**
	 * Logger which contains listener debug parameters
	 */
	log: Logger;
}

export type BaseMessagePayload = {
	jiraHost: string,
	installationId: number,
	gitHubAppConfig?: GitHubAppConfig, //undefined for cloud
	webhookId?: string,
}

export type BranchMessagePayload = BaseMessagePayload & {
	webhookReceived: number,
	webhookId: string,
	// The original webhook payload from GitHub. We don't need to worry about the SQS size limit because metrics show
	// that payload size for deployment_status webhooks maxes out at 9KB.
	webhookPayload: CreateEvent,
}

export type BackfillMessagePayload = BaseMessagePayload & {
	syncType?: SyncType,
	startTime?: string,
	commitsFromDate?: string, //main commits from date, ISO string
	targetTasks?: TaskType[],
	metricTags?: Record<string, string> //extra tags for metrics
}

export type DeploymentMessagePayload = BaseMessagePayload & {
	webhookReceived: number,
	webhookId: string,
	// The original webhook payload from GitHub. We don't need to worry about the SQS size limit because metrics show
	// that payload size for deployment_status webhooks maxes out at 13KB.
	webhookPayload: DeploymentStatusEvent,
	rateLimited?: boolean,
}

export type PushQueueMessagePayload = BaseMessagePayload & {
	repository: PayloadRepository,
	shas: { id: string, issueKeys: string[] }[],
	webhookId: string,
	webhookReceived?: number,
}

export type GitHubAppConfig = {
	gitHubAppId: number | undefined, // undefined for cloud
	appId: number,
	clientId: string,
	gitHubBaseUrl: string, // GITHUB_CLOUD_BASEURL for cloud
	gitHubApiUrl: string,
	uuid: string | undefined,
}

//refer from https://docs.github.com/en/rest/repos/repos#get-a-repository
type PayloadRepository = {
	id: number,
	name: string,
	full_name: string,
	html_url: string,
	owner: { name?: string, login: string },
}

