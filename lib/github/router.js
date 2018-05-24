const getConfig = require('probot-config')
const getJiraClient = require('../jira/client')
const getJiraUtil = require('../jira/util')

module.exports = function route (callback) {
  return async (context) => {
    if (context.payload.sender.type === 'Bot') {
      return
    }

    const config = await getConfig(context, 'jira.yml')
    context.jira = getJiraClient(config, context.payload.repository)

    await callback(context, getJiraUtil(context))
  }
}
