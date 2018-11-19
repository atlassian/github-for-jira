const { enqueuePush } = require('../transforms/push')
const parseSmartCommit = require('../transforms/smart-commit')

module.exports = async (context, jiraClient) => {
  // This keeps the context object the same shape, but
  // filters out any commits that don't have issue keys
  // so we don't have to process them.
  context.payload.commits = context.payload.commits.map(commit => {
    const { issueKeys } = parseSmartCommit(commit.message)
    if (issueKeys) {
      return commit
    }
  }).filter(Boolean)

  if (context.payload.commits.length === 0) {
    return
  }

  // Since a push event can have any number of commits
  // and we have to process each one indvidiually to get the
  // data we need for Jira, send this to a background job
  // so we can close the http connection as soon as the jobs
  // are in the queue.
  await enqueuePush(context.payload, jiraClient.baseURL)
}
