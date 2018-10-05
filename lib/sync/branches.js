const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
const transformBranches = require('./transforms/branch')
const { getBranches } = require('./queries')

module.exports.processBranches = robot => {
  return async function (job) {
    const { installationId, jiraHost, repository } = job.data

    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return
    }

    const jiraClient = await getJiraClient(subscription.id, installationId, subscription.jiraHost)

    const github = await robot.auth(installationId)

    let { repos: repoSyncState } = await subscription.get('repoSyncState')

    let cursor = ((repoSyncState[repository.id] || '').lastBranchCursor || '')

    while (cursor !== undefined) {
      let { edges } = (await github.query(getBranches, {
        owner: repository.owner.login,
        repo: repository.name,
        per_page: 100,
        cursor: cursor || undefined
      })).repository.refs

      const branches = edges.map(({ node: item }) => {
        // translating the object into a schema that matches our transforms
        return {
          name: item.name,
          associatedPullRequestTitle: (item.associatedPullRequests.nodes.length > 0) ? item.associatedPullRequests.nodes[0].title : '',
          commits: item.target.history.nodes,
          lastCommit: {
            author: item.target.author,
            authorTimestamp: item.target.authoredDate,
            fileCount: 0,
            sha: item.target.oid,
            message: item.target.message,
            url: item.target.url
          }
        }
      })

      const { data } = transformBranches({ branches, repository })

      if (!data && edges.length > 0) {
        // No Jira issue found on branches for this page of results
        // But there is still content to parse
        cursor = edges[edges.length - 1].cursor
        await subscription.set(`repoSyncState.repos.${repository.id}.lastBranchCursor`, cursor)
        await subscription.set(`repoSyncState.repos.${repository.id}.branchStatus`, 'pending')
        await subscription.save()
        continue
      } else if (!data) {
        await subscription.set(`repoSyncState.repos.${repository.id}.branchStatus`, 'complete')
        await subscription.set('syncStatus', 'COMPLETE')
        await subscription.save()
        cursor = undefined
        return
      }

      await jiraClient.devinfo.repository.update(data)

      if (edges.length !== 0) {
        cursor = edges[edges.length - 1].cursor
        await subscription.set(`repoSyncState.repos.${repository.id}.lastBranchCursor`, cursor)
        await subscription.set(`repoSyncState.repos.${repository.id}.branchStatus`, 'pending')
        await subscription.save()
        continue
      } else {
        await subscription.set(`repoSyncState.repos.${repository.id}.branchStatus`, 'complete')
        await subscription.set('syncStatus', 'COMPLETE')
        await subscription.save()
        cursor = undefined
        return
      }
    }
  }
}
