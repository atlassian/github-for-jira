const transformPush = require('../transforms/push')

module.exports = async (context) => {
  const author = await context.github.users.getForUser({ username: context.payload.commit.author.username })
  const jiraPayload = transformPush(context.payload, author)

  if (jiraPayload) {
    await context.jira.devinfo.updateRepository(jiraPayload)
  }
}
