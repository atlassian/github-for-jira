import * as Sentry from '@sentry/node';
import { envVars } from './environment-variables';
const { sentryServerDSN, microsEnv, microsServiceVersion, microsEnvDefault } =
  envVars;

export const initializeSentry = (): void => {
  return Sentry.init({
    dsn: sentryServerDSN,
    environment: microsEnv || microsEnvDefault,
    release: microsServiceVersion,
  });
};
