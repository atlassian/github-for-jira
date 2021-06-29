import * as Sentry from '@sentry/node';
import { envVars } from './environment-variables';
const { sentryServerDSN, microsEnv, microsServiceVersion } = envVars;

export const initializeSentry = (): void => {
  return Sentry.init({
    dsn: sentryServerDSN,
    environment: microsEnv || 'development',
    release: microsServiceVersion,
  });
};
