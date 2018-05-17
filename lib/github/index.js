const issueComment = require('./issue-comment')

module.exports = (robot) => {
  robot.on('issue_comment.created', issueComment)
}
