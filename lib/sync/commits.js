const transformCommit = require('../transforms/commit')
const { getCommits: getCommitsQuery } = require('./queries')
const { startJob, updateJobStatus } = require('./jobs')

module.exports.processCommits = (app, queues) => {
  return async function (job) {
    const { jiraClient, github, subscription, repository, cursor } = await startJob(app, job, 'commit')
    if (!subscription) return

    async function getCommits (amount) {
      app.log.debug(`Trying ${amount} commits......`)
      const commitsData = await github.query(getCommitsQuery, {
        owner: repository.owner.login,
        repo: repository.name,
        per_page: amount,
        cursor
      })

      // if the repository is empty, commitsData.repository.ref is null
      const { edges } = commitsData.repository.ref ? commitsData.repository.ref.target.history : { edges: [] }

      if (edges.length === 0) {
        return updateJobStatus(app, jiraClient, queues.commits, job, subscription, edges, 'commit')
      }

      const authors = edges.map(({ node: item }) => item.author)
      const commits = edges.map(({ node: item }) => {
      // translating the object into a schema that matches our transforms
        return {
          author: item.author,
          authorTimestamp: item.authoredDate,
          fileCount: 0,
          sha: item.oid,
          message: item.message,
          url: item.url
        }
      })

      const { data } = transformCommit({ commits, repository }, authors)
      if (data) {
        await jiraClient.devinfo.repository.update(data)
      }

      return updateJobStatus(app, jiraClient, queues.commits, job, subscription, edges, 'commit')
    }

    try {
      return getCommits(100)
    } catch (err) {
      return getCommits(50)
    }
  }
}
