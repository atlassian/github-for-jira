const commit = require('../transforms/commit')
const repository = require('../transforms/repository')

module.exports = async (context) => {
  const jiraPayload = [repository.mapToJira(context.payload.repository, context.payload.commits.map(commit.mapToJira))]

  await context.jira.devinfo.updateBulk(jiraPayload)
}
