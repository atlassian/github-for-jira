const { queues } = require('../worker')

const { processPullRequests } = require('./pull-request')
const { processCommits } = require('./commits.js')

module.exports = async (robot) => {
  const router = robot.route('/jira/sync')

  queues.pullRequests.process(processPullRequests(robot))
  queues.commits.on('error', (err) => robot.log.error(err))
  queues.commits.on('failed', (job, err) => robot.log.error({job, err}))
  queues.commits.process(processCommits(robot))
  queues.discovery.process(discoverContent)

  async function discoverContent (job) {
    const github = await robot.auth(job.data.installationId)
    const { data } = await github.apps.getInstallationRepositories()
    robot.log(`${data.total_count} Repositories for Installation: ${job.data.installationId}`)

    return data.repositories.forEach(async repository => {
      const pullsName = `PullRequests-${repository.name}`
      const commitsName = `Commits-${repository.name}`

      queues.pullRequests.add(
        {
          installationId: job.data.installationId,
          jiraHost: job.data.jiraHost,
          repository
        },
        { jobId: pullsName, removeOnComplete: true }
      )
      queues.pullRequests.on('failed', (job, err) => robot.log.error({job, err}))

      queues.commits.add({
        installationId: job.data.installationId,
        jiraHost: job.data.jiraHost,
        repository
      }, { jobId: commitsName, removeOnComplete: true })
    })
  }

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
