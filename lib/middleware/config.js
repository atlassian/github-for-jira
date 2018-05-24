const getConfig = require('probot-config')

module.exports = async (context) => {
  context.config = await getConfig(context, 'jira.yml')

  return context
}
