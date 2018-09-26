module.exports.discovery = (robot, queues) => {
  return async function discoverContent (job) {
    const github = await robot.auth(job.data.installationId)
    const { data } = await github.apps.getInstallationRepositories()
    robot.log(`${data.total_count} Repositories for Installation: ${job.data.installationId}`)

    return data.repositories.forEach(async repository => {
      const pullsName = `PullRequests-${repository.name}`
      const commitsName = `Commits-${repository.name}`
      const branchesName = `Branches-${repository.name}`

      queues.pullRequests.add(
        {
          installationId: job.data.installationId,
          jiraHost: job.data.jiraHost,
          repository
        },
        { jobId: pullsName, removeOnComplete: true }
      )
      queues.pullRequests.on('failed', (job, err) => robot.log.error({job, err}))

      queues.commits.add({
        installationId: job.data.installationId,
        jiraHost: job.data.jiraHost,
        repository
      }, { jobId: commitsName, removeOnComplete: true })

      queues.branches.add({
        installationId: job.data.installationId,
        jiraHost: job.data.jiraHost,
        repository
      }, { jobId: branchesName, removeOnComplete: true })
    })
  }
}
