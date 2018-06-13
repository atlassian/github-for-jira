const getConfig = require('probot-config')
const getJiraClient = require('../jira/client')
const getJiraUtil = require('../jira/util')

module.exports = function middleware (callback) {
  return async (context) => {
    if (context.payload.sender.type === 'Bot') {
      return
    }

    context.config = await getConfig(context, 'jira.yml')
    context.jira = await getJiraClient(context.id, context.payload.installation.id, context.config.jira)
    context.util = getJiraUtil(context)

    await callback(context)
  }
}
