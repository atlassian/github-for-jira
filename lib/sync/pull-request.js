const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
const transformPullRequest = require('./transforms/pull-request')
const { getPullRequests } = require('./queries')

module.exports.processPullRequests = app => {
  return async function (job) {
    const { installationId, jiraHost, repository } = job.data
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return
    }

    const jiraClient = await getJiraClient(subscription.id, installationId, subscription.jiraHost)

    const github = await app.auth(installationId)

    let { repos: repoSyncState } = await subscription.get('repoSyncState')

    let cursor = ((repoSyncState[repository.id] || '').lastPullCursor || '')

    while (cursor !== undefined) {
      let { edges } = (await github.query(getPullRequests, {
        owner: repository.owner.login,
        repo: repository.name,
        per_page: 100,
        cursor: cursor || undefined
      })).repository.pullRequests

      const pullRequests = edges.map(({ node: pull }) => {
        const { data } = transformPullRequest({ pull_request: pull, repository }, pull.author)

        if (!data) {
          cursor = edges[edges.length - 1].cursor
        } else {
          return data.pullRequests[0]
        }
      }).filter(Boolean)

      if (pullRequests.length > 0) {
        const jiraPayload = {
          id: repository.id,
          name: repository.full_name,
          pullRequests,
          url: repository.html_url,
          updateSequenceId: Date.now()
        }
        // robot.log('jira pullRequests:', jiraPayload.pullRequests)
        await jiraClient.devinfo.repository.update(jiraPayload)
        cursor = edges[edges.length - 1].cursor
        await subscription.set(`repoSyncState.repos.${repository.id}.lastPullCursor`, cursor)
        await subscription.set(`repoSyncState.repos.${repository.id}.pullStatus`, 'pending')
        await subscription.save()
        continue
      } else {
        await subscription.set(`repoSyncState.repos.${repository.id}.pullStatus`, 'complete')
        await subscription.save()
        cursor = undefined
        return
      }
    }
  }
}
