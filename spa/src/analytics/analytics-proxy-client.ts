import { AnalyticClient, ScreenEventProps, TrackEventProps, UIEventProps } from "./types";
import { axiosRest } from "../api/axiosInstance";
import { reportError } from "../utils";
const sendAnalytics = (eventType: string, eventProperties: Record<string, unknown>, eventAttributes?: Record<string, unknown>) => {
	axiosRest.post(`/rest/app/cloud/analytics-proxy`,
		{
			eventType,
			eventProperties,
			eventAttributes
		}).catch(e => {
			reportError(e, {
				path: "sendAnalytics",
				eventType,
				...eventProperties,
				...eventAttributes
			});
		});
};
export const analyticsProxyClient: AnalyticClient = {
	sendScreenEvent: function(eventProps: ScreenEventProps, attributes?: Record<string, unknown>) {
		sendAnalytics("screen", eventProps, attributes);
	},
	sendUIEvent: function (eventProps: UIEventProps, attributes?: Record<string, unknown>) {
		sendAnalytics("ui", {
			...eventProps,
			source: "spa"
		}, attributes);
	},
	sendTrackEvent: function (eventProps: TrackEventProps, attributes?: Record<string, unknown>) {
		sendAnalytics("track", {
			...eventProps,
			source: "spa"
		}, attributes);
	}
};
