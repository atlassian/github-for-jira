import { AnalyticClient, ScreenEventProps, TrackEventProps, UIEventProps } from "./types";
import { axiosRest } from "../api/axiosInstance";
import { reportError } from "~/src/utils";
const sendAnalytics = (eventType: string, eventProperties: Record<string, unknown>, eventAttributes?: Record<string, unknown>) => {
	AP.context.getToken((jwt: string) => {
		axiosRest.post(`/rest/app/cloud/analytics`,
			{
				eventType,
				eventProperties,
				eventAttributes
			},
			{
				headers: {
					authorization: jwt
				}
			}
		).catch(reportError);
	});
};
export const proxyAnalyticsClient: AnalyticClient = {
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
