import { AnalyticClient, ScreenNames } from "./types";
import { useEffect } from "react";

import { loadSoxAnalyticClient } from "./sox-analytics-client";
import { noopAnalyticsClient } from "./noop-analytics-client";

const analyticsClient: AnalyticClient = loadSoxAnalyticClient() || noopAnalyticsClient;

export default analyticsClient;

export const useEffectScreenEvent = (name: ScreenNames) => {
	useEffect(() => {
		analyticsClient.sendScreenEvent({
			name,
			attributes: {
			}
		});
	}, [ name ]);
};

