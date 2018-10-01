const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
const transformPullRequest = require('./transforms/pull-request')
const { getPullRequests } = require('./queries')

module.exports.processPullRequests = app => {
  return async function (job) {
    const { installationId, jiraHost, lastCursor, repository } = job.data
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return
    }

    const jiraClient = await getJiraClient(subscription.id, installationId, subscription.jiraHost)

    const github = await app.auth(installationId)

    let cursor = lastCursor
    const { edges } = (await github.query(getPullRequests, {
      owner: repository.owner.login,
      repo: repository.name,
      per_page: 100,
      cursor
    })).repository.pullRequests

    if (edges.length > 0) {
      const pullRequests = edges.map(({ node: pull }) => {
        const data = transformPullRequest({ pull_request: pull, repository }, pull.author)

        if (!data) {
          // robot.log(`No Jira issue found for [${pull.title}]`)
          return
        }
        return data.data.pullRequests[0]
      }).filter(Boolean)

      if (pullRequests.length > 0) {
        const jiraPayload = {
          id: repository.id,
          name: repository.full_name,
          pullRequests: pullRequests,
          url: repository.html_url,
          updateSequenceId: Date.now()
        }
        // robot.log('jira pullRequests:', jiraPayload.pullRequests)
        await jiraClient.devinfo.repository.update(jiraPayload)
      }
    }
  }
}
