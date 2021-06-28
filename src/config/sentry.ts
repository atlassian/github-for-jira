import * as Sentry from '@sentry/node';

export default (): void => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
  });
}
