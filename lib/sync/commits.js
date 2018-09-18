const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
const transformCommit = require('../transforms/commit')
const { getCommits } = require('./queries')

module.exports.processCommits = robot => {
  return async function (job) {
    const { installationId, jiraHost, repository } = job.data

    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return
    }

    const jiraClient = await getJiraClient(subscription.id, installationId, subscription.jiraHost)

    const github = await robot.auth(installationId)

    const { repos: repoSyncState } = await subscription.get('repoSyncState')

    let cursor = repoSyncState[repository.id]
      ? repoSyncState[repository.id].lastCommitCursor
      : ''

    while (cursor !== undefined) {
      let { edges } = (await github.query(getCommits, {
        owner: repository.owner.login,
        repo: repository.name,
        per_page: 100,
        cursor: cursor || undefined
      })).repository.ref.target.history

      const authors = edges.map(({ node: item }) => item.author)

      const commits = edges.map(({ node: item }) => {
        // translating the object into a schema that matches our transforms
        return {
          author: item.author,
          authorTimestamp: item.authoredDate,
          fileCount: item.changedFiles,
          sha: item.oid,
          message: item.message,
          url: item.url
        }
      })

      const { data } = transformCommit({ commits, repository }, authors)

      if (!data && edges.length > 0) {
        // No Jira issue found on commits for this page of results
        // But there is still content to parse
        cursor = edges[edges.length - 1].cursor
        await subscription.set('repoSyncState.repos', {
          ...repoSyncState,
          [repository.id]: {
            lastCommitCursor: cursor,
            commitStatus: 'pending'
          }
        })
        await subscription.save()
        continue
      } else if (!data) {
        await subscription.set('repoSyncState.repos', {
          ...repoSyncState,
          [repository.id]: {
            lastCommitCursor: undefined,
            commitStatus: 'complete'
          }
        })
        await subscription.save()
        cursor = undefined
        return
      }

      await jiraClient.devinfo.updateRepository(data)

      if (edges.length !== 0) {
        cursor = edges[edges.length - 1].cursor
        await subscription.set('repoSyncState.repos', {
          ...repoSyncState,
          [repository.id]: {
            lastCommitCursor: cursor,
            commitStatus: 'pending'
          }
        })
        await subscription.save()
      } else {
        await subscription.set('repoSyncState.repos', {
          ...repoSyncState,
          [repository.id]: {
            lastCommitCursor: undefined,
            commitStatus: 'complete'
          }
        })
        await subscription.save()
        cursor = undefined
      }
    }
  }
}
