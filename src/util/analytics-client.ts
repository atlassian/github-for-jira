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
	(eventType: "ui" | "track" | "operational", attributes: Record<string, unknown>);
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

	switch (eventType) {
		case "screen":
			sendEvent(analyticsNodeClient.sendScreenEvent({
				...baseAttributes,
				name: attributes.name,
				screenEvent: {
					platform: "web",
					attributes: omit(attributes, "name")
				}
			}));
			break;
		case "ui":
			sendEvent(analyticsNodeClient.sendUIEvent({
				...baseAttributes,
				uiEvent: {
					attributes
				}
			}));
			break;
		case "track":
			sendEvent(analyticsNodeClient.sendTrackEvent({
				...baseAttributes,
				trackEvent: {
					attributes
				}
			}));
			break;
		case "operational":
			sendEvent(analyticsNodeClient.sendOperationalEvent({
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

const sendEvent = (promise: Promise<unknown>) => {
	promise.catch((error) => {
		logger.warn(`Cannot sendAnalytics event: ${error}`);
	});
};
