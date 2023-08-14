import { getLogger } from "config/logger";
import { isNodeTest } from "utils/is-node-env";
import { optionalRequire } from "optional-require";
import { envVars } from "config/env";
import { createHashWithoutSharedSecret } from "utils/encryption";
import _, { omit } from "lodash";
import { MicrosEnvTypeEnum } from "interfaces/common";
import { isTestJiraHost } from "config/jira-test-site-check";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { SQS } from "aws-sdk";
import { SendMessageRequest } from "aws-sdk/clients/sqs";

const { analyticsClient } = optionalRequire("@atlassiansox/analytics-node-client", true) || {};
const logger = getLogger("analytics");

let analyticsNodeClient;

export interface ScreenEventProps {
	name: string;
}

export interface TrackOpUiEventProps {
	action: string;
	actionSubject: string;
	source: string;
}

const calculateClientEnv = () => {
	switch (envVars.MICROS_ENVTYPE) {
		case MicrosEnvTypeEnum.dev:
			return "dev";
		case MicrosEnvTypeEnum.staging:
			return "stg";
		case MicrosEnvTypeEnum.prod:
			return "prod";
	}
	return "dev";
};

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
): Promise<void> => {

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
	} catch (err) {
		logger.error({ err }, "Cannot publish the event to SQS");
	}
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
	(jiraHost: string, eventType: "screen", eventProps: ScreenEventProps & Record<string, unknown>, attributes: Record<string, unknown>, accountId?: string);
	(jiraHost: string, eventType: "ui" | "operational" | "track", eventProps: TrackOpUiEventProps  & Record<string, unknown>, attributes: Record<string, unknown>, accountId?: string);
} = async (jiraHost: string, eventType: "screen" | "ui" | "operational" | "track", eventProps: (ScreenEventProps | TrackOpUiEventProps)  & Record<string, unknown>, unsafeAttributes: Record<string, unknown> = {}, accountId?: string): Promise<void> => {

	if (isTestJiraHost(jiraHost) && envVars.MICROS_ENVTYPE === MicrosEnvTypeEnum.prod) {
		logger.warn("Skip analytics for test jira in prod");
		return;
	}

	const attributes = _.cloneDeep(unsafeAttributes);
	if (attributes.jiraHost && (typeof attributes.jiraHost === "string")) {
		attributes.jiraHost = createHashWithoutSharedSecret(attributes.jiraHost);
	}

	attributes.appKey = envVars.APP_KEY;

	if (await booleanFlag(BooleanFlags.SEND_ANALYTICS_TO_SQS, jiraHost)) {
		await sendAnalyticsWithSqs(jiraHost, eventType, eventProps, attributes, accountId);
		return;
	}

	logger.debug({ jiraHost }, analyticsClient ? "Found analytics client." : `No analytics client found.`);

	if (!analyticsClient) {
		logger.warn("No analyticsClient available");
		return;
	}

	if (isNodeTest()) {
		logger.warn("Analytics is disabled in tests");
		return;
	}

	if (!analyticsNodeClient){
		// Values defined by DataPortal. Do not change their values as it will affect our metrics logs and dashboards.
		analyticsNodeClient = analyticsClient({
			env: calculateClientEnv(),
			product: "gitHubForJira"
		});
	}

	const baseEventProps = {
		userId: accountId || "anonymousId",
		userIdType: "atlassianAccount",
		tenantIdType: "cloudId",
		tenantId: "NONE" // TODO: determine from jiraHost
	};

	logger.debug({ eventType }, "Sending analytics");

	switch (eventType) {
		case "screen": {
			const screenEventProps = eventProps as ScreenEventProps;
			sendEvent(eventType, screenEventProps.name, analyticsNodeClient.sendScreenEvent({
				...baseEventProps,
				// Unfortunately, "Screen event" is the only one that requires "name" outside of event props.
				// Let's encapsulate this knowledge here; for the outside know "name" shall be the property of the event!
				// (Otherwise it is getting extremely confusing, let's keep confusion in one place only.)
				name: screenEventProps.name,
				screenEvent: {
					platform: "web",
					...omit(screenEventProps, "name"),
					attributes
				}
			}));
			break; }
		case "ui": {
			const uiEventProps = eventProps as TrackOpUiEventProps;
			sendEvent(eventType, uiEventProps.action + " " + uiEventProps.actionSubject, analyticsNodeClient.sendUIEvent({
				...baseEventProps,
				uiEvent: {
					...uiEventProps,
					attributes
				}
			}));
		}
			break;
		case "track": {
			const trackEventProps = eventProps as TrackOpUiEventProps;
			sendEvent(eventType, trackEventProps.action + " " + trackEventProps.actionSubject, analyticsNodeClient.sendTrackEvent({
				...baseEventProps,
				trackEvent: {
					...trackEventProps,
					attributes
				}
			}));
			break; }
		case "operational": {
			const opEventProps = eventProps as TrackOpUiEventProps;
			sendEvent(eventType, opEventProps.action + " " + opEventProps.actionSubject, analyticsNodeClient.sendOperationalEvent({
				...baseEventProps,
				operationalEvent: {
					...opEventProps,
					attributes
				}
			}));
			break; }
		default:
			logger.warn(`Cannot sendAnalytics: unknown eventType`);
			break;
	}
};

const sendEvent = (eventType: string, name: unknown, promise: Promise<unknown>) => {
	promise.catch((error) => {
		logger.warn(`Cannot sendAnalytics event ${eventType} - ${name}, error: ${error}`);
	});
};
