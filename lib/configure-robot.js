const Sentry = require('@sentry/node')
const sentryStream = require('bunyan-sentry-stream')

const setupFrontend = require('./frontend')
const setupGitHub = require('./github')
const setupJira = require('./jira')

module.exports = (app) => {
  setupFrontend(app)
  setupGitHub(app)
  setupJira(app)

  app.log.target.addStream(sentryStream(Sentry, 'error'))

  return app
}
