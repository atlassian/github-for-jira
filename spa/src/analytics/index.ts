import { AnalyticClient, ScreenNames } from "./types";
import { useEffect } from "react";

import { proxyAnalyticsClient } from "./proxy-analytics-client";

const analyticsClient: AnalyticClient = proxyAnalyticsClient();

export default analyticsClient;

let lastSent = "";

export const useEffectScreenEvent = (name: ScreenNames, attributes?: Record<string, unknown>) => {
	// TODO: add better serialization because JSON.stringify() does not guarantee the ordering of the elements, which
	// 			means theoretically it could output different strings for the same object
	const attributesSerialized = JSON.stringify(attributes || {});

	useEffect(() => {
		// TODO: for some reason it may fire several events for the same event. Please fix!
		if (lastSent === name + attributesSerialized) {
			return;
		}
		analyticsClient.sendScreenEvent({
			name
		}, attributes);

		lastSent = name + attributesSerialized;

		// Use serialized attributes to make useEffect() compare real content instead of references to an object.
		// Otherwise, it may fire unnecessary events when the reference is changed but not the content,
		// thus skewing the dashboards.
	}, [ name, attributesSerialized ]);

};

