import { getLogger 	} from "config/logger";
import { omit } from "lodash";
import { optionalRequire } from "optional-require";
import { isNodeProd } from "utils/is-node-env";

const { analyticsClient } = optionalRequire("@atlassiansox/analytics-node-client") || {};
const logger = getLogger("analytics");
const instance = process.env.INSTANCE_NAME;
const appKey = `com.github.integration${instance ? `.${instance}` : ""}`;

let analyticsNodeClient;

function sendAnalytics(eventType: "trait")
function sendAnalytics(eventType: "screen", attributes:{name:string} & Record<string,unknown>)
function sendAnalytics(eventType: "ui" | "track" | "operational", attributes: Record<string,unknown>)
function sendAnalytics(eventType: string, attributes?: Record<string, unknown>): void {
	if (!analyticsClient && !isNodeProd()){
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

	attributes!.appKey = appKey;

	logger.debug({ eventType }, "Sending analytics");

	switch (eventType) {
		case "screen":
			wrapPromise(analyticsNodeClient.sendScreenEvent({
				...baseAttributes,
				name: attributes?.name,
				screenEvent: {
					platform: "web",
					attributes: omit(attributes, "name")
				}
			}));
			break;
		case "ui":
			wrapPromise(analyticsNodeClient.sendUIEvent({
				...baseAttributes,
				uiEvent: {
					attributes
				}
			}));
			break;
		case "track":
			wrapPromise(analyticsNodeClient.sendTrackEvent({
				...baseAttributes,
				trackEvent: {
					attributes
				}
			}));
			break;
		case "trait":
			wrapPromise(analyticsNodeClient.sendTraitEvent({
				entityType: attributes?.entityType,
				entityId: attributes?.entityId,
				entityTraits: attributes?.entityTraits
			}));
			break;
		case "operational":
			wrapPromise(analyticsNodeClient.sendOperationalEvent({
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
}

function wrapPromise(promise: Promise<unknown>) {
	promise.catch((error) => {
		logger.warn(`Cannot sendAnalytics event: ${error}`);
	});
}

export { sendAnalytics };
