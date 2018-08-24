const Queue = require('bull')

const discoverContentQueue = new Queue('Content discovery', process.env.REDIS_URL)
const pullRequestQueue = new Queue('Pull Requests transformation', process.env.REDIS_URL)
const commitQueue = new Queue('Commit transformation', process.env.REDIS_URL)

const { processPullRequests } = require('./pull-request')
const { processCommits } = require('./commits.js')

module.exports = async (robot) => {
  const router = robot.route('/jira/sync')

  pullRequestQueue.process(processPullRequests(robot))
  commitQueue.on('error', (err) => robot.log.error(err))
  commitQueue.on('failed', (job, err) => robot.log.error({job, err}))
  commitQueue.process(processCommits(robot))
  discoverContentQueue.process(discoverContent)

  async function discoverContent (job) {
    const github = await robot.auth(job.data.installationId)
    const { data } = await github.apps.getInstallationRepositories()
    robot.log(`${data.total_count} Repositories for Installation: ${job.data.installationId}`)

    return data.repositories.forEach(async repository => {
      const pullsName = `PullRequests-${repository.name}`
      const commitsName = `Commits-${repository.name}`

      pullRequestQueue.add(
        {
          installationId: job.data.installationId,
          jiraHost: job.data.jiraHost,
          repository
        },
        { jobId: pullsName, removeOnComplete: true }
      )
      pullRequestQueue.on('failed', (job, err) => robot.log.error({job, err}))

      commitQueue.add({
        installationId: job.data.installationId,
        jiraHost: job.data.jiraHost,
        repository
      }, { jobId: commitsName, removeOnComplete: true })
    })
  }

  router.get('/', async (req, res) => {
    req.log('Starting Jira sync')

    // TODO: cleaning queues before each request while testing
    discoverContentQueue.clean(5000)
    pullRequestQueue.clean(5000)
    commitQueue.clean(5000)

    const name = `Discover-${req.query.installationId}`

    discoverContentQueue.add({ installationId: req.query.installationId, jiraHost: req.query.host }, { jobId: name })

    return res.sendStatus(202)
  })
}
