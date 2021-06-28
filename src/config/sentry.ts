import * as Sentry from '@sentry/node';
import { envVars } from './environment-variables';
import { RewriteFrames } from '@sentry/integrations';

const { sentryServerDSN, microsEnv, microsServiceVersion } = envVars;

export default (): void => {
  Sentry.init({
    dsn: sentryServerDSN,
    environment: microsEnv || 'development',
    release: microsServiceVersion,
    integrations: [
      new RewriteFrames({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        root: global.__rootdir__,
      }),
    ],
  });
};
