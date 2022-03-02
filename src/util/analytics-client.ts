import {getLogger} from "../config/logger";
import { omit } from "lodash";
import { optionalRequire } from "optional-require";
import {AnalyticsConfigEnum} from "../interfaces/common";
import {isNodeProd} from "./isNodeEnv";

const { analyticsClient } = optionalRequire("@atlassiansox/analytics-node-client") || {};
const logger = getLogger("analytics")
const instance = process.env.INSTANCE_NAME;
const appKey = `com.github.integration${instance ? `.${instance}` : ""}`;

function sendAnalytics(eventType: "trait")
function sendAnalytics(eventType: "screen", attributes:{name:string} & Record<string,unknown>)
function sendAnalytics(eventType: "ui" | "track" | "operational", attributes: Record<string,unknown>)
function sendAnalytics(eventType: string, attributes?: Record<string, unknown>): void {
	if(!analyticsClient && !isNodeProd()){
		return;
	}

	const analyticsNodeClient = analyticsClient({
		env: AnalyticsConfigEnum.ProdEnv,
		product: AnalyticsConfigEnum.Product
	});

	const baseAttributes = {
		userId: "anonymousId",
		userIdType: "atlassianAccount",
		tenantIdType: "cloudId",
		tenantId: "NONE",
	}

	attributes!.appKey = appKey;

	switch (eventType) {
		case "screen":
			wrapPromises(analyticsNodeClient.sendScreenEvent({
				...baseAttributes,
				name: attributes?.name,
				screenEvent: {
					platform: "web",
					attributes: {
						...omit(attributes, "name"),
						appKey
					}
				}
			}))
			break;
		case "ui":
			wrapPromises(analyticsNodeClient.sendUIEvent({
				...baseAttributes,
				uiEvent: {
					attributes: attributes
				}
			}))
			break;
		case "track":
			wrapPromises(analyticsNodeClient.sendTrackEvent({
				...baseAttributes,
				trackEvent: {
					attributes: attributes
				}
			}))
			break;
		case "trait":
			wrapPromises(analyticsNodeClient.sendTraitEvent({
				entityType: attributes?.entityType,
				entityId: attributes?.entityId,
				entityTraits: attributes?.entityTraits
			}))
			break;
		case "operational":
			wrapPromises(analyticsNodeClient.sendOperationalEvent({
				...baseAttributes,
				operationalEvent: {
					attributes: attributes
				}
			}))
			break;
		default:
			logger.warn(`Cannot sendAnalytics: unknown eventType`)
			break;
	}
}

function wrapPromises(promise: Promise<unknown>) {
	promise.catch((error) => {
		logger.warn(`Cannot sendAnalytics event: ${error}`)
	})
}

export {sendAnalytics};
