const issueComment = require('./issue-comment')
const issue = require('./issue')
const middleware = require('./middleware')
const pullRequest = require('./pull-request')
const push = require('./push')

const oauth = require('github-oauth')({
  githubClient: process.env.GITHUB_CLIENT_ID,
  githubSecret: process.env.GITHUB_CLIENT_SECRET,
  baseURL: process.env.APP_URL,
  loginURI: '/github/login',
  callbackURI: '/github/callback'
})

module.exports = (robot) => {
  robot.on(['issue_comment.created', 'issue_comment.edited'], middleware(issueComment))

  robot.on(['issues.opened', 'issues.edited'], middleware(issue))

  robot.on('push', middleware(push))

  robot.on(['pull_request.opened', 'pull_request.closed', 'pull_request.reopened', 'pull_request.edited'], middleware(pullRequest))

  const app = robot.route()
  oauth.addRoutes(app)
  oauth.on('token', function (token, serverResponse) {
    console.log('here is your shiny new github oauth token', token)
    serverResponse.end(JSON.stringify(token))
  })
}
