const { Subscription } = require('../models')
const transformBranch = require('../transforms/branch')
const parseSmartCommit = require('../transforms/smart-commit')
const reduceProjectKeys = require('../jira/util/reduce-project-keys')

module.exports.createBranch = async (context, jiraClient) => {
  const { data: jiraPayload } = await transformBranch(context)

  if (!jiraPayload) {
    return
  }

  await jiraClient.devinfo.repository.update(jiraPayload)

  const subscription = await Subscription.getSingleInstallation(
    jiraClient.baseURL,
    context.payload.installation.id
  )
  const projects = subscription.projects || []

  jiraPayload.branches.map(branch => reduceProjectKeys(branch, projects))

  await subscription.update({ projects })
}

module.exports.deleteBranch = async (context, jiraClient) => {
  const { issueKeys } = parseSmartCommit(context.payload.ref)

  if (!issueKeys) {
    return
  }

  await jiraClient.devinfo.branch.delete(
    context.payload.repository.id,
    context.payload.ref
  )
}
