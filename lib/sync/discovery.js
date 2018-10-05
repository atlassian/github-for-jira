module.exports.discovery = (robot, queues) => {
  return async function discoverContent (job) {
    const github = await robot.auth(job.data.installationId)
    const repositories = await github.paginate(github.apps.getInstallationRepositories({ per_page: 100 }), res => res.data.repositories)
    robot.log(`${repositories.length} Repositories for Installation: ${job.data.installationId}`)

    return repositories.forEach(async repository => {
      queues.pullRequests.add(
        {
          installationId: job.data.installationId,
          jiraHost: job.data.jiraHost,
          repository
        },
        { removeOnComplete: true, removeOnFail: true }
      )
      queues.pullRequests.on('failed', (job, err) => robot.log.error({job, err}))

      queues.commits.add({
        installationId: job.data.installationId,
        jiraHost: job.data.jiraHost,
        repository
      }, { removeOnComplete: true, removeOnFail: true })
      queues.commits.on('failed', (job, err) => robot.log.error({job, err}))

      queues.branches.add({
        installationId: job.data.installationId,
        jiraHost: job.data.jiraHost,
        repository
      }, { removeOnComplete: true, removeOnFail: true })
      queues.branches.on('failed', (job, err) => robot.log.error({job, err}))
    })
  }
}
