import * as Sentry from "@sentry/node";

export const initializeSentry = (): void => {
	return Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment: process.env.MICROS_ENV,
		release: process.env.MICROS_SERVICE_VERSION
	});
};
