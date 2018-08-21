const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
const transformPullRequest = require('../transforms/pull-request')

module.exports = robot => {
  return async function processPullRequests (job) {
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
        // robot.log(`No Jira issue found for [${pull_request.title}]`)
        return
      }
      return data.data.pullRequests[0]
    }).filter(Boolean)

    if (pullRequests.length > 0) {
      const jiraPayload = {
        id: repository.id,
        name: repository.full_name,
        pullRequests: pullRequests,
        url: repository.url,
        updateSequenceId: Date.now()
      }
      // robot.log('jira pullRequests:', jiraPayload.pullRequests)
      await jiraClient.devinfo.updateRepository(jiraPayload)
    }
  }
}
