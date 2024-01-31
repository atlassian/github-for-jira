import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { createHashWithoutSharedSecret } from "utils/encryption";
import _ from "lodash";
import { MicrosEnvTypeEnum } from "interfaces/common";
import { isTestJiraHost } from "config/jira-test-site-check";
import { AWSError, SQS } from "aws-sdk";
import { SendMessageRequest } from "aws-sdk/clients/sqs";
import { PromiseResult } from "aws-sdk/lib/request";

const logger = getLogger("analytics");

export interface ScreenEventProps {
	name: string;
}

export interface TrackOpUiEventProps {
	action: string;
	actionSubject: string;
	source: string;
}

interface SQSEventPayload {
	accountId?: string;
	eventType: "screen" | "ui" | "operational" | "track";
	eventProps: ScreenEventProps | TrackOpUiEventProps;
	eventAttributes?: Record<string, unknown>;
}

export interface SQSAnalyticsMessagePayload {
	jiraHost: string;
	eventPayload: SQSEventPayload;
}

export const sendAnalyticsWithSqs = async (
	jiraHost: string,
	eventType: "screen" | "ui" | "operational" | "track",
	eventProps: (ScreenEventProps | TrackOpUiEventProps)  & Record<string, unknown>,
	attributes: Record<string, unknown> = {},
	accountId?: string
): Promise<PromiseResult<SQS.SendMessageResult, AWSError> | undefined> => {

	const payload: SQSAnalyticsMessagePayload = {
		jiraHost,
		eventPayload: {
			accountId,
			eventType,
			eventProps,
			eventAttributes: attributes
		}
	};
	const sqs = new SQS({ apiVersion: "2012-11-05", region: envVars.SQS_INCOMINGANALYTICEVENTS_QUEUE_REGION });
	const params: SendMessageRequest = {
		MessageBody: JSON.stringify(payload),
		QueueUrl: envVars.SQS_INCOMINGANALYTICEVENTS_QUEUE_URL,
		DelaySeconds: 0
	};
	try {
		const sendMessageResult = await sqs.sendMessage(params)
			.promise();
		logger.debug({ sendMessageResult }, "Published an analytic event to SQS");
		return sendMessageResult;
	} catch (err: unknown) {
		logger.error({ err }, "Cannot publish the event to SQS");
	}
	return undefined;
};

/**
 *
 * @param jiraHost
 * @param eventType
 * @param eventProps - even though it requires only a few fields leaving the rest as a loose Record, in fact all the properties
 * 										 are well-defined and rigid. See the sample payloads here: https://bitbucket.org/atlassian/analytics-node-client/src/master/
 * @param unsafeAttributes - free-form attributes, will be included as "attributes" property into the properties of the event
 */
export const sendAnalytics: {
	(jiraHost: string, eventType: "screen", eventProps: ScreenEventProps & Record<string, unknown>, attributes: Record<string, unknown>, accountId?: string): Promise<PromiseResult<SQS.SendMessageResult, AWSError> | undefined>;
	(jiraHost: string, eventType: "ui" | "operational" | "track", eventProps: TrackOpUiEventProps  & Record<string, unknown>, attributes: Record<string, unknown>, accountId?: string): Promise<PromiseResult<SQS.SendMessageResult, AWSError> | undefined>;
} = async (jiraHost: string, eventType: "screen" | "ui" | "operational" | "track", eventProps: (ScreenEventProps | TrackOpUiEventProps)  & Record<string, unknown>, unsafeAttributes: Record<string, unknown> = {}, accountId?: string): Promise<PromiseResult<SQS.SendMessageResult, AWSError> | undefined> => {

	if (isTestJiraHost(jiraHost) && envVars.MICROS_ENVTYPE === MicrosEnvTypeEnum.prod) {
		logger.warn("Skip analytics for test jira in prod");
		return undefined;
	}

	const attributes = _.cloneDeep(unsafeAttributes);
	if (attributes.jiraHost && (typeof attributes.jiraHost === "string")) {
		attributes.jiraHost = createHashWithoutSharedSecret(attributes.jiraHost);
	}

	attributes.appKey = envVars.APP_KEY;

	return await sendAnalyticsWithSqs(jiraHost, eventType, eventProps, attributes, accountId);
};
