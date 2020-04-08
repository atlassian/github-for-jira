const issueComment = require('./issue-comment')
const issue = require('./issue')
const middleware = require('./middleware')
const pullRequest = require('./pull-request')
const push = require('./push')
const { createBranch, deleteBranch } = require('./branch')
const webhookTimeout = require('../middleware/webhook-timeout')

module.exports = (robot) => {
  robot.on('*', (context) => {
    context.log({ event: context.event, action: context.payload.action }, 'Event received')
  })

  robot.on(['issue_comment.created', 'issue_comment.edited'], webhookTimeout(middleware(issueComment)))

  robot.on(['issues.opened', 'issues.edited'], middleware(issue))

  robot.on('push', middleware(push))

  robot.on(['pull_request.opened', 'pull_request.closed', 'pull_request.reopened', 'pull_request.edited'], middleware(pullRequest))

  robot.on('create', middleware(createBranch))
  robot.on('delete', middleware(deleteBranch))
}
