const transformBranch = require('../transforms/branch')
const parseSmartCommit = require('../transforms/smart-commit')

module.exports.createBranch = async (context, jiraClient) => {
  const { data: jiraPayload } = await transformBranch(context)

  if (!jiraPayload) {
    return
  }

  await jiraClient.devinfo.repository.update(jiraPayload)
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
