const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
const getJiraUtil = require('../jira/util')

module.exports = function middleware (callback) {
  return async (context) => {
    if (context.payload.sender.type === 'Bot') {
      return
    }

    const subscriptions = await Subscription.getAllForInstallation(context.payload.installation.id)
    if (!subscriptions.length) {
      return
    }

    for (let subscription of subscriptions) {
      const jiraClient = await getJiraClient(context.id, context.payload.installation.id, subscription.jiraHost)
      const util = getJiraUtil(jiraClient)

      await callback(context, jiraClient, util)
    }
  }
}
