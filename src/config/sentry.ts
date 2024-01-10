import * as Sentry from "@sentry/node";
import { envVars }  from "./env";

const { SENTRY_DSN, MICROS_ENV, MICROS_SERVICE_VERSION } = envVars;

export const initializeSentry = (): void => {
	Sentry.init({
		dsn: SENTRY_DSN,
		environment: MICROS_ENV,
		release: MICROS_SERVICE_VERSION
	});
};
