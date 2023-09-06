import * as Sentry from "@sentry/node";
import { Express } from "express";
import { envVars }  from "./env";

const { SENTRY_DSN, MICROS_ENV, MICROS_SERVICE_VERSION } = envVars;

//https://docs.sentry.io/platforms/node/guides/express/#monitor-performance
export const initializeSentry = (app: Express): void => {
	return Sentry.init({
		dsn: SENTRY_DSN,
		environment: MICROS_ENV,
		release: MICROS_SERVICE_VERSION,
		integrations: [
			// enable HTTP calls tracing
			new Sentry.Integrations.Http({ tracing: true }),
			// enable Express.js middleware tracing
			new Sentry.Integrations.Express({
				app
			}),
			...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations()
		],
		tracesSampleRate: Number(envVars.SENTRY_TRACING_RATE) || 1.0
	});
};
