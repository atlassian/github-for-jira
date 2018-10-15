const transformPullRequest = require('./transforms/pull-request')
const { getPullRequests } = require('./queries')
const { startJob, updateJobStatus } = require('./jobs')

module.exports.processPullRequests = (app, queues) => {
  return async function (job) {
    const { jiraClient, github, subscription, repository, cursor } = await startJob(app, job, 'pull')
    if (!subscription) return

    const { edges } = (await github.query(getPullRequests, {
      owner: repository.owner.login,
      repo: repository.name,
      per_page: 100,
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

    await updateJobStatus(app, queues.pullRequests, job, subscription, edges, 'pull')
  }
}
