const transformPullRequest = require('../transforms/pull-request')

module.exports = async (context) => {
  const author = await context.github.users.getForUser({ username: context.payload.pull_request.user.login })
  const jiraPayload = transformPullRequest(context.payload, author.data)

  if (jiraPayload) {
    await context.jira.devinfo.updateRepository(jiraPayload)
  }
}
