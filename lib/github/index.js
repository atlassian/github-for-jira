const issueComment = require('./issue-comment')
const route = require('./router')

module.exports = (robot) => {
  robot.on('issue_comment.created', route(issueComment))
}
