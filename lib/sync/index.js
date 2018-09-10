const { queues } = require('../worker')

module.exports = async (robot) => {
  const router = robot.route('/jira/sync')

  router.get('/', async (req, res) => {
    req.log('Starting Jira sync')

    // TODO: cleaning queues before each request while testing
    queues.discovery.clean(5000)
    queues.pullRequests.clean(5000)
    queues.commits.clean(5000)

    const name = `Discover-${req.query.installationId}`

    queues.discovery.add({ installationId: req.query.installationId, jiraHost: req.query.host }, { jobId: name })

    return res.sendStatus(202)
  })
}
