import { AnalyticClient, ScreenNames } from "./types";
import { useEffect } from "react";

import { loadSoxAnalyticClient } from "./sox-analytics-client";
import { noopAnalyticsClient } from "./noop-analytics-client";

const analyticsClient: AnalyticClient = loadSoxAnalyticClient() || noopAnalyticsClient;

export default analyticsClient;

export const useEffectScreenEvent = (name: ScreenNames, attributes?: Record<string, string | number>) => {

	//stringify so that in the useEffect dependency array it is comparing real content, instead of object instance refence.
	//Otherwise it may cause unnecessary fireing to the analytics backend when attribute object instance changed, skewing our analytics dashboard
	const jsonStrAttr = JSON.stringify(attributes || {});

	useEffect(() => {
		analyticsClient.sendScreenEvent({
			name,
			attributes: {
				...JSON.parse(jsonStrAttr)
			}
		});
	}, [ name, jsonStrAttr]);
};

