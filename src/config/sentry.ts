import Sentry from '@sentry/node';

export default (): void => Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.HEROKU_SLUG_COMMIT,
});
