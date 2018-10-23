const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')

const tasks = {
  pull: require('./pull-request').getPullRequests,
  branch: require('./branches').getBranches,
  commit: require('./commits').getCommits
}
const taskTypes = Object.keys(tasks)

const getNextTask = (subscription) => {
  const repos = subscription.get('repoSyncState').repos
  for (const [repositoryId, repoStatus] of Object.entries(repos)) {
    const task = taskTypes.find(taskType => repoStatus[`${taskType}Status`] !== 'complete')
    if (!task) continue
    const { repository, [getCursorKey(task)]: cursor } = repoStatus
    return { task, repositoryId, repository, cursor }
  }
}

const upperFirst = str => str.substring(0, 1).toUpperCase() + str.substring(1)
const getCursorKey = jobType => `last${upperFirst(jobType)}Cursor`

module.exports.processInstallation = (app, queues) => {
  const updateJobStatus = async (jiraClient, job, edges, task, repositoryId) => {
    const { installationId, jiraHost } = job.data
    // Get a fresh subscription instance
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)

    const status = edges.length > 0 ? 'pending' : 'complete'
    app.log(`Updating job status for installationId=${installationId}, repositoryId=${repositoryId}, task=${task}, status=${status}`)
    subscription.set(`repoSyncState.repos.${repositoryId}.${task}Status`, status)
    if (edges.length > 0) {
      // there's more data to get
      subscription.set(`repoSyncState.repos.${repositoryId}.${getCursorKey(task)}`, edges[edges.length - 1].cursor)
      const { removeOnComplete, removeOnFail } = job.opts
      queues.installation.add(job.data, { removeOnComplete, removeOnFail })
    } else {
      // no more data (last page was processed of this job type)
      if (!getNextTask(subscription)) {
        subscription.set('syncStatus', 'COMPLETE')
        app.log(`Sync status for installationId=${installationId} is complete`)
        try {
          await jiraClient.devinfo.migration.complete()
        } catch (err) {
          app.log.error(err || 'Error sending the `complete` event to JIRA')
        }
      } else {
        app.log(`Sync status for installationId=${installationId} is active`)
      }
    }
    await subscription.save()
  }

  return async function (job) {
    const { installationId, jiraHost } = job.data
    app.log(`Starting job for installationId=${installationId}`)

    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) return

    const jiraClient = await getJiraClient(subscription.id, installationId, subscription.jiraHost)
    const github = await app.auth(installationId)

    const nextTask = getNextTask(subscription)
    if (!nextTask) return

    await subscription.update({ syncStatus: 'ACTIVE' })

    let { task, repository, repositoryId, cursor } = nextTask
    if (!repository) {
      // Old records don't have this info. New ones have it
      repository = await github.repos.getById({ repositoryId })
      subscription.set(`repoSyncState.repos.${repository.id}.repository`, repository)
      await subscription.save()
    }
    app.log(`Starting task for installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`)

    const processor = tasks[task]

    const pagedProcessor = (perPage) => {
      return processor(github, repository, cursor, perPage)
    }

    const execute = async () => {
      for (const perPage of [50, 10, 5, 1]) {
        try {
          return await pagedProcessor(perPage)
        } catch (err) {
          if (!String(err).includes('MAX_NODE_LIMIT_EXCEEDED')) {
            throw err
          }
          app.log(`MAX_NODE_LIMIT_EXCEEDED installationId=${installationId}, repositoryId=${repositoryId}, task=${task}, perPage=${perPage}`)
        }
      }
      throw new Error(`MAX_NODE_LIMIT_EXCEEDED installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`)
    }

    try {
      const { edges, jiraPayload } = await execute()
      if (jiraPayload) {
        await jiraClient.devinfo.repository.update(jiraPayload)
      }
      await updateJobStatus(jiraClient, job, edges, task, repositoryId)
    } catch (err) {
      const reteLimit = +(err.headers && err.headers['x-ratelimit-reset'])
      const delay = Math.max(Date.now() - reteLimit * 1000, 0)
      if (delay) { // if not NaN or 0
        app.log(`Delaying job for ${delay}ms installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`)
        const { removeOnComplete, removeOnFail } = job.opts
        queues.installation.add(job.data, { delay, removeOnComplete, removeOnFail })
        return
      }
      throw err
    }
  }
}
