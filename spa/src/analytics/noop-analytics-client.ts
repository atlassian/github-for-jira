import { AnalyticClient } from "./types";

export const noopAnalyticsClient: AnalyticClient = {
	sendScreenEvent: () => {},
	sendUIEvent: () => {},
	sendTrackEvent: () => {},
};
