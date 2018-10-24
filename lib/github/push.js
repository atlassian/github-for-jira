const { Subscription } = require('../models')
const transformPush = require('../transforms/push')
const reduceProjectKeys = require('../jira/util/reduce-project-keys')

module.exports = async (context, jiraClient, util) => {
  await transformPush(context.payload, context.github, async ({ data: jiraPayload, commands }) => {
    await jiraClient.devinfo.repository.update(jiraPayload)

    // Don't run Jira commands
    // await util.runJiraCommands(commands)

    const subscription = await Subscription.getSingleInstallation(
      jiraClient.baseURL,
      context.payload.installation.id
    )
    const projects = subscription.projects || []

    jiraPayload.commits.map(commit => reduceProjectKeys(commit, projects))

    await subscription.update({ projects })
  })
}
