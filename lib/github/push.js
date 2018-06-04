const transformPullRequest = require('../transforms/pull-request')
const transformPush = require('../transforms/push')

module.exports = async (context) => {
  let jiraPayload

  switch (context.event) {
    case 'push':
      jiraPayload = transformPush(context.payload)
      break;

    case 'pull_request':
      jiraPayload = transformPullRequest(context.payload)
  }

  if (jiraPayload) {
    await context.jira.devinfo.updateRepository(jiraPayload)
  }
}
