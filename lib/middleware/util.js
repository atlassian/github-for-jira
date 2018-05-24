const getJiraUtil = require('../jira/util')

module.exports = async (context) => {
  context.util = getJiraUtil(context)

  return context
}
