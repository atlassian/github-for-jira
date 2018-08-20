const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
// const getJiraUtil = require('../util')

const Queue = require('bull')
const transformPullRequest = require('../transforms/pull-request')
const transformCommit = require('../transforms/commit')

const discoverContentQueue = new Queue('Content discovery', 'redis://127.0.0.1:6379')
const pullRequestQueue = new Queue('Pull Requests transformation', 'redis://127.0.0.1:6379')
const commitQueue = new Queue('Commit transformation', 'redis://127.0.0.1:6379')

module.exports = async (robot) => {
  const router = robot.route('/jira/sync')

  async function discoverContent (job) {
    const github = await robot.auth(job.data.installationId)
    const { data } = await github.apps.getInstallationRepositories()
    robot.log(`${data.total_count} Repositories for Installation: ${job.data.installationId}`)

    return data.repositories.forEach(async repository => {
      const pullsName = `PullRequests-${repository.name}`
      const commitsName = `Commits-${repository.name}`

      pullRequestQueue.add(pullsName,
        {
          installationId: job.data.installationId,
          jiraHost: job.data.jiraHost,
          repository
        },
        { jobId: pullsName }
      )

      pullRequestQueue.process(pullsName, processPullRequests)

      commitQueue.add(commitsName, {
        installationId: job.data.installationId,
        jiraHost: job.data.jiraHost,
        repository
      }, { jobId: commitsName })

      commitQueue.process(commitsName, processCommits)
    })
  }

  async function processCommits (job) {
    const { installationId, jiraHost, repository } = job.data
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return
    }

    const jiraClient = await getJiraClient(subscription.id, installationId, subscription.jiraHost)
    // TODO: figure out what Jira Util does
    // const util = getJiraUtil(jiraClient)

    const github = await robot.auth(installationId)
    let { data: items } = (await github.repos.getCommits({
      owner: repository.owner.login,
      repo: repository.name,
      per_page: 100
    }))

    const authors = items.map(item => item.author)

    const commits = items.map(item => {
      // translating the object into a schema that matches our transforms
      return {
        author: item.author,
        authorTimestamp: item.commit.author.date,
        sha: item.sha,
        message: item.commit.message,
        url: item.html_url
      }
    })

    const { data, commands } = transformCommit({ commits, repository }, authors)

    if (!data) {
      // robot.log(`No Jira issue found on commits for ${repository.name}`)
      return
    }

    robot.log('jira commits:', { data: commits })
    await jiraClient.devinfo.updateRepository(data)
  }

  async function processPullRequests (job) {
    const { installationId, jiraHost, repository } = job.data
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return
    }

    const jiraClient = await getJiraClient(subscription.id, installationId, subscription.jiraHost)
    // TODO: figure out what Jira Util does
    // const util = getJiraUtil(jiraClient)

    const github = await robot.auth(installationId)
    const { data } = (await github.pullRequests.getAll({
      owner: repository.owner.login,
      repo: repository.name,
      per_page: 100,
      state: 'all'
    }))

    const pullRequests = data.map(pull_request => {
      robot.log(`Processing [${pull_request.title}]`)

      const data = transformPullRequest({ pull_request, repository }, pull_request.user)

      if (!data) {
        robot.log(`No Jira issue found for [${pull_request.title}]`)
        return
      }
      return data.data.pullRequests[0]
    })

    const jiraPayload = {
      id: repository.id,
      name: repository.full_name,
      pullRequests: pullRequests.filter(Boolean),
      url: repository.url,
      updateSequenceId: Date.now()
    }
    robot.log('jira pullRequests:', jiraPayload.pullRequests)
    await jiraClient.devinfo.updateRepository(jiraPayload)
  }

  router.get('/', async (req, res) => {
    req.log('Starting Jira sync')

    // TODO: cleaning queues before each request while testing
    discoverContentQueue.clean(5000)
    pullRequestQueue.clean(5000)
    commitQueue.clean(5000)

    const name = `Discover-${req.query.installationId}`

    discoverContentQueue.add(name, { installationId: req.query.installationId, jiraHost: req.query.host }, { jobId: name })
    discoverContentQueue.process(name, discoverContent)

    return res.sendStatus(202)
  })
}
