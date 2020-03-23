const Sentry = require('@sentry/node')

const AxiosErrorEventDecorator = require('../models/axios-error-event-decorator')
const SentryScopeProxy = require('../models/sentry-scope-proxy')
const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
const getJiraUtil = require('../jira/util')
const enhanceOctokit = require('../config/enhance-octokit')

let newrelic
if (process.env.NEWRELIC_KEY) {
  newrelic = require('newrelic')
}

// Returns an async function that reports errors errors to Sentry.
// This works similar to Sentry.withScope but works in an async context.
// A new Sentry hub is assigned to context.sentry and can be used later to add context to the error message.
const withSentry = function (callback) {
  return async (context) => {
    context.sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient())
    context.sentry.configureScope(scope => scope.addEventProcessor(AxiosErrorEventDecorator.decorate))
    context.sentry.configureScope(scope => scope.addEventProcessor(SentryScopeProxy.processEvent))

    try {
      await callback(context)
    } catch (err) {
      context.sentry.captureException(err)
      throw err
    }
  }
}

const isFromIgnoredRepo = (payload) => {
  // These point back to a repository for an installation that
  // is generating an unusually high number of push events. This
  // disables it temporarily. See https://github.com/github/integrations-jira-internal/issues/24.
  //
  // GitHub Apps install: https://admin.github.com/stafftools/users/seequent/installations/491520
  // Repository: https://admin.github.com/stafftools/repositories/seequent/lf_github_testing
  return payload.installation.id === 491520 && payload.repository.id === 205972230
}

module.exports = function middleware (callback) {
  return withSentry(async (context) => {
    enhanceOctokit(context.github, context.log)

    if (newrelic !== undefined) {
      newrelic.addCustomAttributes({
        'Webhook ID': context.id,
        'Webhook Event': `${context.name}.${context.payload.action}`
      })
    }

    context.sentry.setExtra('GitHub Payload', {
      event: context.name,
      action: context.payload.action,
      id: context.id,
      repo: (context.payload.repository) ? context.repo() : undefined
    })

    const gitHubInstallationId = context.payload.installation.id
    context.log = context.log.child({ gitHubInstallationId })

    if (context.payload.sender.type === 'Bot') {
      context.log({ noop: 'bot', botId: context.payload.sender.id, botLogin: context.payload.sender.login }, 'Halting futher execution since the sender is a bot')
      return
    }

    if (isFromIgnoredRepo(context.payload)) {
      context.log({ noop: 'ignored_repo', installation_id: context.payload.installation.id, repository_id: context.payload.repository.id }, 'Halting futher execution since the repository is explicilty ignored')
      return
    }

    const subscriptions = await Subscription.getAllForInstallation(gitHubInstallationId)
    if (!subscriptions.length) {
      context.log({ noop: 'no_subscriptions' }, 'Halting futher execution since no subscriptions were found')
      return
    }

    context.sentry.setTag('transaction', `webhook:${context.name}.${context.payload.action}`)
    for (let subscription of subscriptions) {
      const jiraHost = subscription.jiraHost

      context.sentry.setTag('jiraHost', jiraHost)
      context.sentry.setTag('gitHubInstallationId', gitHubInstallationId)
      context.sentry.setUser({ jiraHost, gitHubInstallationId })

      context.log = context.log.child({ jiraHost })

      const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, context.log)
      if (jiraClient == null) {
        // Don't call callback if we have no jiraClient
        context.log.error({ noop: 'no_jira_client' }, `No enabled installation found for ${jiraHost}.`)
        return
      }
      const util = getJiraUtil(jiraClient)

      try {
        await callback(context, jiraClient, util)
      } catch (err) {
        context.sentry.captureException(err)
      }
    }
  })
}
