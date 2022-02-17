import {getLogger} from "../config/logger";
import { omit } from "lodash";
import { optionalRequire } from "optional-require";
import {AnalyticsVariablesEnum} from "../interfaces/common";
const { analyticsClient } = optionalRequire("@atlassiansox/analytics-node-client") || {};
const logger = getLogger("analytics")

const instance = process.env.INSTANCE_NAME;
const appKey = `com.github.integration${instance ? `.${instance}` : ""}`;

function sendAnalytics(eventType: "trait")
function sendAnalytics(eventType: "screen", attributes:{name:string} & Record<string,unknown>)
function sendAnalytics(eventType: "ui" | "track" | "operational", attributes: Record<string,unknown>)
async function sendAnalytics(eventType: string, attributes?: Record<string, unknown>): Promise<any> {
	if(!analyticsClient){
		return;
	}

	const analyticsNodeClient = analyticsClient({
		env: AnalyticsVariablesEnum.ProdEnv, // prod, stg or dev
		product: AnalyticsVariablesEnum.Product, // required - do not change - https://hello.atlassian.net/browse/DE-8853
	});

	const baseAttributes = {
		userId: "anonymousId",
		userIdType: "atlassianAccount",
		tenantIdType: "cloudId",
		tenantId: "NONE",
	}

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
					attributes: {
						...omit(attributes, "name"),
						appKey
					}
				}
			}))
			break;
		case "track":
			wrapPromises(analyticsNodeClient.sendTrackEvent({
				...baseAttributes,
				trackEvent: {
					attributes: {
						...omit(attributes, "name"),
						appKey
					}
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
					attributes: {
						...omit(attributes, "name"),
						appKey
					}
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
