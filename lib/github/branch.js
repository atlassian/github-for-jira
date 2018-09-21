const transformBranch = require('../transforms/branch')

module.exports = async (context, jiraClient, util) => {
  const { data: jiraPayload } = await transformBranch(context.payload, context.github)

  if (!jiraPayload) {
    return
  }

  await jiraClient.devinfo.repository.update(jiraPayload)
}
