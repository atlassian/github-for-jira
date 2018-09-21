const transformPush = require('../transforms/push')

module.exports = async (context, jiraClient, util) => {
  const { data: jiraPayload, commands } = await transformPush(context.payload, context.github)

  if (!jiraPayload) {
    return
  }

  await jiraClient.devinfo.repository.update(jiraPayload)

  await util.runJiraCommands(commands)
}
