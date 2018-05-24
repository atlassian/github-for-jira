const getJiraClient = require('../jira/client')

module.exports = async (context) => {
  context.jira = getJiraClient(context.config, context.payload.repository)

  return context
}
