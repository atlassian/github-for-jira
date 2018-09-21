const transformPullRequest = require('../transforms/pull-request')

module.exports = async (context, jiraClient) => {
  const author = await context.github.users.getForUser({ username: context.payload.pull_request.user.login })
  const { data: jiraPayload } = transformPullRequest(context.payload, author.data)

  if (!jiraPayload) {
    return
  }

  await jiraClient.devinfo.repository.update(jiraPayload)
}
