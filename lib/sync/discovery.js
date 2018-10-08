module.exports.discovery = (robot, queues) => {
  return async function discoverContent (job) {
    const github = await robot.auth(job.data.installationId)
    const repositories = await github.paginate(github.apps.getInstallationRepositories({ per_page: 100 }), res => res.data.repositories)
    robot.log(`${repositories.length} Repositories for Installation: ${job.data.installationId}`)

    return repositories.forEach(async (repository, i) => {
      // Add jobs for each content type to their respective queue for each repository.
      // `priority: i` lowers the priority by 1 for every repository
      // in the installation, allowing smaller installations to complete faster
      // and distributing jobs across the queue instead of processing every repository
      // for a single installation sequentially
      queues.pullRequests.add(
        {
          installationId: job.data.installationId,
          jiraHost: job.data.jiraHost,
          repository
        },
        { priority: i, removeOnComplete: true, removeOnFail: true }
      )

      queues.commits.add({
        installationId: job.data.installationId,
        jiraHost: job.data.jiraHost,
        repository
      }, { priority: i, removeOnComplete: true, removeOnFail: true })

      queues.branches.add({
        installationId: job.data.installationId,
        jiraHost: job.data.jiraHost,
        repository
      }, { priority: i, removeOnComplete: true, removeOnFail: true })
    })
  }
}
