const Sentry = require('@sentry/node')
const sentryStream = require('bunyan-sentry-stream')
const Integrations = require('@sentry/integrations')

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.HEROKU_SLUG_COMMIT
    ? process.env.HEROKU_SLUG_COMMIT
    : undefined,
  integrations: [
    new Integrations.Transaction(),
    new Integrations.Debug(),
    new Integrations.ExtraErrorData()
  ]
})

module.exports = app => {
  app.log.debug('Errors will be reported to Sentry')
  app.log.target.addStream(sentryStream(Sentry, 'error'))

  const router = app.route('/')
  router.get('/boom', req => {
    const err = new Error('Boom')
    if (req.query.async) {
      app.log.error(err)
      return Promise.reject(err)
    }
    app.log.error(err)
    throw err
  })
}

module.exports.Sentry = Sentry
