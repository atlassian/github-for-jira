const transformPush = require('../transforms/push')

module.exports = async (context, jiraClient, util) => {
  const usernames = context.payload.commits.reduce((usernames, commit) => ([
    ...usernames,
    commit.author.username
  ]), [])

  const authors = (await Promise.all(usernames.map(username => context.github.users.getForUser({ username }))))
    .map(response => response.data)

  const authorMap = authors.reduce((authorMap, author) => ({
    ...authors,
    [author.login]: author
  }), {})

  const { data: jiraPayload, commands } = transformPush(context.payload, authorMap)

  if (!jiraPayload) {
    return
  }

  await jiraClient.devinfo.updateRepository(jiraPayload)

  await util.runJiraCommands(commands)
}
