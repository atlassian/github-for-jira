const transformPullRequest = require('../../transforms/pull-request')

module.exports = async (robot) => {
  const router = robot.route('/jira/sync')

  router.get('/', async (req, res) => {
    req.log('Starting Jira sync')
    const { installationId, repo, owner } = req.query
    const github = await robot.auth(installationId)

    const { data } = (await github.pullRequests.getAll({
      owner,
      repo,
      per_page: 10,
      state: 'all'
    }))

    // TODO: Parse and send the Pull Requests to Jira
    data.forEach(async pull_request => {
      const author = await github.users.getForUser({ username: pull_request.user.login })
      const repository = await github.repos.get({ owner, repo })
      const payload = { pull_request, repository }
      const { data: jiraPayload } = await transformPullRequest(payload, author.data)
      req.log({ jiraPayload })
    })

    return res.sendStatus(202)
  })
}
