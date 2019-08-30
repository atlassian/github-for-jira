const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
const getJiraUtil = require('../jira/util')
const Sentry = require('@sentry/node')

// Returns an async function that reports errors errors to Sentry.
// This works similar to Sentry.withScope but works in an async context.
// A new Sentry hub is assigned to context.sentry and can be used later to add context to the error message.
const withSentry = function (callback) {
  return async (context) => {
    context.sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient())

    try {
      await callback(context)
    } catch (err) {
      context.sentry.captureException(err)
      throw err
    }
  }
}

module.exports = function middleware (callback) {
  return withSentry(async (context) => {
    context.sentry.setExtra('GitHub Payload', {
      event: context.name,
      action: context.payload.action,
      id: context.id,
      repo: (context.payload.repository) ? context.repo() : undefined
    })

    if (context.payload.sender.type === 'Bot') {
      return
    }

    const gitHubInstallationId = context.payload.installation.id
    const subscriptions = await Subscription.getAllForInstallation(gitHubInstallationId)
    if (!subscriptions.length) {
      return
    }

    context.sentry.setTag('transaction', `webhook:${context.name}.${context.payload.action}`)
    for (let subscription of subscriptions) {
      const jiraHost = subscription.jiraHost

      context.sentry.setTag('jiraHost', jiraHost)
      context.sentry.setTag('gitHubInstallationId', gitHubInstallationId)
      context.sentry.setUser({ jiraHost, gitHubInstallationId })

      context.log = context.log.child({ gitHubInstallationId, jiraHost })

      const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, context.log)
      const util = getJiraUtil(jiraClient)

      try {
        await callback(context, jiraClient, util)
      } catch (err) {
        context.sentry.captureException(err)
      }
    }
  })
}
