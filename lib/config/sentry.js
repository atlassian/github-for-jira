const Sentry = require('@sentry/node');

const initializeSentry = () => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: process.env.HEROKU_SLUG_COMMIT,
  });
};

module.exports = {
  Sentry,
  initializeSentry,
};
