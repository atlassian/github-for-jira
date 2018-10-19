const transformBranches = require('./transforms/branch')
const { getBranches: getBranchesQuery } = require('./queries')
const { startJob, updateJobStatus } = require('./jobs')

module.exports.processBranches = (app, queues) => {
  return async function (job) {
    const { jiraClient, github, subscription, repository, cursor } = await startJob(app, job, 'branch')
    if (!subscription) return

    async function getBranches (amount) {
      app.log.debug(`Trying ${amount} branches on ${repository.full_name}`)
      const { edges } = (await github.query(getBranchesQuery, {
        owner: repository.owner.login,
        repo: repository.name,
        per_page: amount,
        cursor
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
      if (data) {
        await jiraClient.devinfo.repository.update(data)
      }
      return updateJobStatus(app, jiraClient, queues.branches, job, edges, 'branch')
    }

    try {
      return getBranches(50)
    } catch (err) {
      return getBranches(10)
    }
  }
}
