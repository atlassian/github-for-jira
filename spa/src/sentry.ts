import React from "react";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router-dom";
import * as Sentry from "@sentry/react";

export const initSentry = () => {
	if(SENTRY_SPA_DSN && SENTRY_SPA_DSN.startsWith("https")) {
		Sentry.init({
			dsn: SENTRY_SPA_DSN,
			integrations: [
				new Sentry.BrowserTracing({
					// See docs for support of different versions of variation of react router
					// https://docs.sentry.io/platforms/javascript/guides/react/configuration/integrations/react-router/
					routingInstrumentation: Sentry.reactRouterV6Instrumentation(
						React.useEffect,
						useLocation,
						useNavigationType,
						createRoutesFromChildren,
						matchRoutes
					),
				}),
				new Sentry.Replay()
			],

			// Set tracesSampleRate to 1.0 to capture 100%
			// of transactions for performance monitoring.
			tracesSampleRate: 1.0,

			// Set `tracePropagationTargets` to control for which URLs distributed tracing should be enabled
			tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],

			// Capture Replay for 10% of all sessions,
			// plus for 100% of sessions with an error
			replaysSessionSampleRate: 0.1,
			replaysOnErrorSampleRate: 1.0,
		});
	}
};
