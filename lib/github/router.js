const getJiraClient = require('../jira/client')
const getJiraUtil = require('../jira/util')

module.exports = function route (callback) {
  return async (context) => {
    context.jira = getJiraClient()

    await callback(context, getJiraUtil(context))
  }
}
