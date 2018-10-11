const transformPush = require('../transforms/push')
const { queues } = require('../worker')

module.exports = async (context, jiraClient, util) => {
  const { baseURL: jiraHost } = jiraClient
  const { repository, installation } = context.payload
  const { owner: { login: owner }, name: repo } = repository
  const { id: installationId } = installation

  await transformPush(context.payload, async ({ data: jiraPayload, commands }) => {
    // await jiraClient.devinfo.repository.update(jiraPayload)

    if (jiraPayload.commits.length > 0) {
      const data = { jiraPayload, installationId, jiraHost, owner, repo }
      queues.push.add(data)
    }

    await util.runJiraCommands(commands)
  })
}
