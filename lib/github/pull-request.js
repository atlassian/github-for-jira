const { Subscription } = require('../models')
const transformPullRequest = require('../transforms/pull-request')
const reduceProjectKeys = require('../jira/util/reduce-project-keys')

module.exports = async (context, jiraClient, util) => {
  const author = await context.github.users.getForUser({ username: context.payload.pull_request.user.login })
  const { data: jiraPayload } = transformPullRequest(context.payload, author.data)
  const { pull_request: pullRequest } = context.payload

  const linkifiedBody = await util.unfurl(pullRequest.body)
  if (linkifiedBody) {
    const editedPullRequest = context.issue({
      body: linkifiedBody,
      id: pullRequest.id
    })
    await context.github.issues.edit(editedPullRequest)
  }

  if (!jiraPayload) {
    return
  }

  await jiraClient.devinfo.repository.update(jiraPayload)

  const subscription = await Subscription.getSingleInstallation(
    jiraClient.baseURL,
    context.payload.installation.id
  )
  const projects = subscription.projects || []

  jiraPayload.pullRequests.map(pull => reduceProjectKeys(pull, projects))
  jiraPayload.branches.map(branch => reduceProjectKeys(branch, projects))

  await subscription.update({ projects })
}
