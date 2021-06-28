import * as Sentry from '@sentry/node';
import { Event } from '@sentry/node';
import { envVars } from './environment-variables';
import bunyan from 'bunyan';
const { sentryServerDSN, microsEnv, microsServiceVersion } = envVars;

export const beforeSendToSentry = (event: Event) => {
  const logger = bunyan.createLogger({ name: 'sentry' });

  if (event.request?.data && typeof event.request.data === 'string') {
    try {
      logger.info('have request data');
    } catch (err) {
      // If for some reason the parsing or sanitization fails, remove the request body to ensure
      // there is no bad data being sent to Sentry
      logger.error(
        `failed to send metrics to sentry: ${JSON.stringify(err, null, 2)}`,
      );
    }
  }

  return event;
};

// export const initializeSentry = (): void => {
Sentry.init({
  dsn: sentryServerDSN,
  environment: microsEnv || 'development',
  release: microsServiceVersion,
  beforeSend: beforeSendToSentry,
});
// };
