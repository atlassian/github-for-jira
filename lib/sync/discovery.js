const { Subscription } = require('../models')

const jobOpts = { removeOnComplete: true, removeOnFail: true }

module.exports.discovery = (app, queues) => {
  return async function discoverContent (job) {
    const { jiraHost, installationId } = job.data
    const github = await app.auth(installationId)
    const repositories = await github.paginate(github.apps.getInstallationRepositories({ per_page: 100 }), res => res.data.repositories)
    app.log(`${repositories.length} Repositories found for installationId=${installationId}`)

    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (repositories.length === 0) {
      subscription.syncStatus = 'COMPLETE'
      await subscription.save()
      return
    }

    // Store an empty object per repository to indicate that the sync for that repo is pending
    const repos = repositories.reduce((obj, repo) => {
      obj[repo.id] = {}
      return obj
    }, {})
    subscription.set(`repoSyncState.repos`, repos)
    await subscription.save()

    // Create jobs
    return repositories.forEach(repository => {
      const jobData = { installationId, jiraHost, repository }

      queues.pullRequests.add(jobData, jobOpts)
      queues.commits.add(jobData, jobOpts)
      queues.branches.add(jobData, jobOpts)
    })
  }
}
