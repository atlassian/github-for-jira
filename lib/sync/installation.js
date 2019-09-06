const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
const { getRepositorySummary } = require('./jobs')
const OctokitError = require('../models/octokit-error')

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
      await subscription.save()

      const { removeOnComplete, removeOnFail } = job.opts
      const delay = Number(process.env.LIMITER_PER_INSTALLATION) || 1000
      queues.installation.add(job.data, { attempts: 3, delay, removeOnComplete, removeOnFail })
    } else {
      // no more data (last page was processed of this job type)
      if (!getNextTask(subscription)) {
        subscription.set('syncStatus', 'COMPLETE')
        app.log(`Sync status for installationId=${installationId} is complete`)
        try {
          await jiraClient.devinfo.migration.complete()
        } catch (err) {
          app.log.error(err, 'Error sending the `complete` event to JIRA')
        }
      } else {
        app.log(`Sync status for installationId=${installationId} is pending`)
        const { removeOnComplete, removeOnFail } = job.opts
        queues.installation.add(job.data, { attempts: 3, removeOnComplete, removeOnFail })
      }
    }
    await subscription.save()
  }

  async function getEnhancedGitHub (installationId) {
    const github = await app.auth(installationId)
    OctokitError.wrapRequestErrors(github)

    // Record elapsed time for each GraphQL request
    github.hook.before('request', () => {
      github.timeStart = Date.now()
    })

    github.hook.after('request', () => {
      const elapsed = Date.now() - github.timeStart
      app.log.debug(`GitHub Request time for ${installationId}: (${elapsed}ms)`)
    })

    return github
  }

  return async function (job) {
    const { installationId, jiraHost } = job.data

    job.sentry.setUser({ gitHubInstallationId: installationId, jiraHost })

    app.log(`Starting job for installationId=${installationId}`)

    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) return

    const jiraClient = await getJiraClient(subscription.jiraHost, installationId, app.log)
    const github = await getEnhancedGitHub(installationId)

    const nextTask = getNextTask(subscription)
    if (!nextTask) return

    await subscription.update({ syncStatus: 'ACTIVE' })

    const { task, repositoryId, cursor } = nextTask
    let { repository } = nextTask
    if (!repository) {
      // Old records don't have this info. New ones have it
      const { data: repo } = await github.repos.getById({ id: repositoryId })
      repository = getRepositorySummary(repo)
      subscription.set(`repoSyncState.repos.${repository.id}.repository`, repository)
      await subscription.save()
    }
    app.log(`Starting task for installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`)

    const processor = tasks[task]

    const pagedProcessor = (perPage) => {
      return processor(github, repository, cursor, perPage)
    }

    const execute = async () => {
      for (const perPage of [20, 10, 5, 1]) {
        try {
          return await pagedProcessor(perPage)
        } catch (err) {
          if (!String(err).includes('MAX_NODE_LIMIT_EXCEEDED')) {
            throw err
          }
        }
      }
      throw new Error(`Error processing GraphQL query: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`)
    }

    try {
      const { edges, jiraPayload } = await execute()
      if (jiraPayload) {
        try {
          await jiraClient.devinfo.repository.update(jiraPayload, { preventTransitions: true })
        } catch (err) {
          if (err.response && err.response.status === 400) {
            job.sentry.setExtra('Response body', err.response.data.errorMessages)
            job.sentry.setExtra('Jira payload', err.response.data.jiraPayload)
          }

          if (err.request) {
            job.sentry.setExtra('Request', { host: err.request.domain, path: err.request.path, method: err.request.method })
          }

          if (err.response) {
            job.sentry.setExtra('Response', {
              status: err.response.status,
              statusText: err.response.statusText,
              body: err.response.body
            })
          }

          throw err
        }
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
      if (String(err).includes('connect ETIMEDOUT')) {
        // There was a network connection issue.
        // Add the job back to the queue with a 5 second delay
        app.log(`ETIMEDOUT error, retrying in 5 seconds: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`)
        const { removeOnComplete, removeOnFail } = job.opts
        queues.installation.add(job.data, { delay: 5000, removeOnComplete, removeOnFail })
        return
      }
      if (String(err.message).includes('You have triggered an abuse detection mechanism')) {
        // Too much server processing time, wait 60 seconds and try again
        app.log(`Abuse detection triggered. Retrying in 60 seconds: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`)
        const { removeOnComplete, removeOnFail } = job.opts
        queues.installation.add(job.data, { delay: 60000, removeOnComplete, removeOnFail })
        return
      }
      throw err
    }
  }
}
