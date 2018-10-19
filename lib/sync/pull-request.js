const transformPullRequest = require('./transforms/pull-request')
const { getPullRequests: getPullRequestQuery } = require('./queries')
const { startJob, updateJobStatus } = require('./jobs')

module.exports.processPullRequests = (app, queues) => {
  return async function (job) {
    const { jiraClient, github, subscription, repository, cursor } = await startJob(app, job, 'pull')
    if (!subscription) return

    async function getPullRequests (amount) {
      const { edges } = (await github.query(getPullRequestQuery, {
        owner: repository.owner.login,
        repo: repository.name,
        per_page: amount,
        cursor
      })).repository.pullRequests

      const pullRequests = edges.map(({ node: pull }) => {
        const { data } = transformPullRequest({ pull_request: pull, repository }, pull.author)
        return data && data.pullRequests[0]
      }).filter(Boolean)

      if (pullRequests.length > 0) {
        const jiraPayload = {
          id: repository.id,
          name: repository.full_name,
          pullRequests,
          url: repository.html_url,
          updateSequenceId: Date.now()
        }
        await jiraClient.devinfo.repository.update(jiraPayload)
      }

      return updateJobStatus(app, jiraClient, queues.pullRequests, job, edges, 'pull')
    }

    try {
      // Simple retry
      return getPullRequests(100)
    } catch (err) {
      return getPullRequests(50)
    }
  }
}
