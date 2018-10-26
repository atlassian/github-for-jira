const { Subscription } = require('../models')
const { getRepositorySummary } = require('./jobs')

const jobOpts = {
  removeOnComplete: true,
  removeOnFail: true,
  attempts: 3
}

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

    // Store the repository object to prevent doing an additional query in each job
    // Also, with an object per repository we can calculate which repos are synched or not
    const repos = repositories.reduce((obj, repo) => {
      obj[repo.node_id] = { repository: getRepositorySummary(repo) }
      return obj
    }, {})
    subscription.set(`repoSyncState.repos`, repos)
    await subscription.save()

    // Create job
    queues.installation.add({ installationId, jiraHost }, jobOpts)
  }
}
