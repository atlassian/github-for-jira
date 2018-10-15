const { Subscription } = require('../models')

module.exports.discovery = (robot, queues) => {
  return async function discoverContent (job) {
    const { jiraHost, installationId } = job.data
    const github = await robot.auth(installationId)
    const repositories = await github.paginate(github.apps.getInstallationRepositories({ per_page: 100 }), res => res.data.repositories)
    robot.log(`${repositories.length} Repositories for Installation: ${installationId}`)

    if (repositories.length === 0) {
      const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
      subscription.syncStatus = 'COMPLETE'
      await subscription.save()
    }

    return repositories.forEach(async repository => {
      queues.pullRequests.add(
        {
          installationId,
          jiraHost,
          repository
        },
        { removeOnComplete: true, removeOnFail: true }
      )

      queues.commits.add({
        installationId,
        jiraHost,
        repository
      }, { removeOnComplete: true, removeOnFail: true })

      queues.branches.add({
        installationId,
        jiraHost,
        repository
      }, { removeOnComplete: true, removeOnFail: true })
    })
  }
}
