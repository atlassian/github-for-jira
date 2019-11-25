const Sentry = require('@sentry/node');

const initializeSentry = () => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    release: process.env.HEROKU_SLUG_COMMIT,
  });
};

module.exports = {
  Sentry,
  initializeSentry,
};
