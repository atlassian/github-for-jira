import { AnalyticClient, ScreenEventProps, TrackEventProps, UIEventProps } from "./types";
import { axiosRest, axiosRestWithNoJwt } from "../api/axiosInstance";
import { reportError } from "../utils";
const sendAnalytics = (eventType: string, eventProperties: Record<string, unknown>, eventAttributes?: Record<string, unknown>, requestId?: string) => {
	const eventData = {
		eventType,
		eventProperties,
		eventAttributes
	};
	const eventError = {
		path: "sendAnalytics",
		eventType,
		...eventProperties,
		...eventAttributes
	};

	if (requestId) {
		axiosRestWithNoJwt.post(`/rest/app/cloud/deferred/analytics-proxy/${requestId}`, eventData)
			.catch(e => {
				reportError(e, eventError);
			});
	} else {
		axiosRest.post(`/rest/app/cloud/analytics-proxy`, eventData)
			.catch(e => {
				reportError(e, eventError);
			});
	}
};
export const analyticsProxyClient: AnalyticClient = {
	sendScreenEvent: function(eventProps: ScreenEventProps, attributes?: Record<string, unknown>, requestId?: string) {
		sendAnalytics("screen", eventProps, attributes, requestId);
	},
	sendUIEvent: function (eventProps: UIEventProps, attributes?: Record<string, unknown>, requestId?: string) {
		sendAnalytics("ui", {
			...eventProps,
			source: "spa"
		}, attributes, requestId);
	},
	sendTrackEvent: function (eventProps: TrackEventProps, attributes?: Record<string, unknown>, requestId?: string) {
		sendAnalytics("track", {
			...eventProps,
			source: "spa"
		}, attributes, requestId);
	}
};
