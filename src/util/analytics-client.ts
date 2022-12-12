import { getLogger 	} from "config/logger";
import { omit } from "lodash";
import { isNodeProd } from "utils/is-node-env";
import { optionalRequire } from "optional-require";

const { analyticsClient } = optionalRequire("@atlassiansox/analytics-node-client", true) || {};
const logger = getLogger("analytics");
const instance = process.env.INSTANCE_NAME;
const appKey = `com.github.integration${instance ? `.${instance}` : ""}`;

let analyticsNodeClient;

export const sendAnalytics: {
	(eventType: "screen", attributes: { name: string } & Record<string, unknown>);
	(eventType: "track", attributes: { name: string, source: string } & Record<string, unknown>);
	(eventType: "ui" | "operational", attributes: Record<string, unknown>);
} = (eventType: string, attributes: Record<string, unknown> = {}): void => {

	logger.info(analyticsClient ? "Found analytics client." : `No analytics client found.`);

	if (!analyticsClient || !isNodeProd()) {
		return;
	}

	if (!analyticsNodeClient){
		// Values defined by DataPortal. Do not change their values as it will affect our metrics logs and dashboards.
		analyticsNodeClient = analyticsClient({
			env: "prod", // This needs to be "prod" as we're using prod Jira instances.
			product: "gitHubForJira"
		});
	}

	const baseAttributes = {
		userId: "anonymousId",
		userIdType: "atlassianAccount",
		tenantIdType: "cloudId",
		tenantId: "NONE"
	};

	attributes.appKey = appKey;

	logger.debug({ eventType }, "Sending analytics");

	const name = attributes.name || "";
	switch (eventType) {
		case "screen":
			sendEvent(eventType, name, analyticsNodeClient.sendScreenEvent({
				...baseAttributes,
				name: attributes.name,
				screenEvent: {
					platform: "web",
					attributes: omit(attributes, "name")
				}
			}));
			break;
		case "ui":
			sendEvent(eventType, name, analyticsNodeClient.sendUIEvent({
				...baseAttributes,
				uiEvent: {
					attributes
				}
			}));
			break;
		case "track":
			sendEvent(eventType, name, analyticsNodeClient.sendTrackEvent({
				...baseAttributes,
				trackEvent: {
					source: attributes["source"],
					action: attributes["action"] || attributes.name,
					actionSubject: attributes["actionSubject"] || attributes.name,
					attributes
				}
			}));
			break;
		case "operational":
			sendEvent(eventType, name, analyticsNodeClient.sendOperationalEvent({
				...baseAttributes,
				operationalEvent: {
					attributes
				}
			}));
			break;
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
