const transformBranch = require('../transforms/branch')

module.exports.createBranch = async (context, jiraClient) => {
  const { data: jiraPayload } = await transformBranch(context)

  if (!jiraPayload) {
    return
  }

  await jiraClient.devinfo.repository.update(jiraPayload)
}

module.exports.deleteBranch = async (context, jiraClient) => {
  // TODO: this isn't working yet:
  const exists = await jiraClient.devinfo.branch.exists(context.payload.ref)
  await jiraClient.devinfo.branch.delete(
    context.payload.repository.id,
    context.payload.ref
  )
}
