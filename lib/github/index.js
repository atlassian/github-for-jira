const issueComment = require('./issue-comment')
const issue = require('./issue')
const route = require('./router')

module.exports = (robot) => {
  robot.on(['issue_comment.created', 'issue_comment.edited'], route(issueComment))

  robot.on(['issues.opened', 'issues.edited'], route(issue))
}
