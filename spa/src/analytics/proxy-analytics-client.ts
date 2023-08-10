import { AnalyticClient, ScreenEventProps, TrackEventProps, UIEventProps } from "./types";
import { axiosRest } from "../api/axiosInstance";

export const proxyAnalyticsClient = function(): AnalyticClient {

	const sendAnalytics = (eventType: string, eventProperties: ScreenEventProps | UIEventProps | TrackEventProps, eventAttributes?: Record<string, unknown>) => {
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
			).catch(console.error);
		});
	};

	return {
		sendScreenEvent: function(eventProps: ScreenEventProps, attributes?: Record<string, unknown>) {
			sendAnalytics("screen", eventProps, attributes);
		},
		sendUIEvent: function (eventProps: UIEventProps, attributes?: Record<string, unknown>) {
			sendAnalytics("ui", eventProps, attributes);
		},
		sendTrackEvent: function (eventProps: TrackEventProps, attributes?: Record<string, unknown>) {
			sendAnalytics("track", eventProps, attributes);
		}
	};
};
