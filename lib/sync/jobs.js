const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')

const jobTypes = ['pull', 'branch', 'commit']
const repoIsPending = repoStatus => {
  const pending = jobTypes.filter(jobType => repoStatus[`${jobType}Status`] !== 'complete')
  return pending.length > 0 ? pending : null
}
const getPendingRepos = subscription =>
  Object.entries(subscription.get('repoSyncState').repos)
    .filter(([id, repoStatus]) => repoIsPending(repoStatus))

const jobInfo = (installationId, repository, jobType) => {
  return `installationId=${installationId}, repositoryId=${repository.id}, job=${jobType}`
}

const upperFirst = str => str.substring(0, 1).toUpperCase() + str.substring(1)
const getCursorKey = jobType => `last${upperFirst(jobType)}Cursor`

exports.startJob = async (app, job, jobType) => {
  const { installationId, jiraHost, repository } = job.data
  app.log(`Starting job for ${jobInfo(installationId, repository, jobType)}`)

  const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
  if (!subscription) return {}

  const jiraClient = await getJiraClient(subscription.id, installationId, subscription.jiraHost)
  const github = await app.auth(installationId)

  await subscription.update({ syncStatus: 'ACTIVE' })

  const { repos: repoSyncState } = subscription.get('repoSyncState')
  const repoStatus = repoSyncState[repository.id] || {}
  const cursor = repoStatus[getCursorKey(jobType)] || undefined

  return {
    jiraClient,
    github,
    subscription,
    repository,
    cursor
  }
}

exports.updateJobStatus = async (app, jiraClient, queue, job, subscription, edges, jobType) => {
  const { installationId, repository } = job.data
  const status = edges.length > 0 ? 'pending' : 'complete'
  app.log(`Updating job status for ${jobInfo(installationId, repository, jobType)}, status=${status}`)
  subscription.set(`repoSyncState.repos.${repository.id}.${jobType}Status`, status)

  if (edges.length > 0) {
    subscription.set(`repoSyncState.repos.${repository.id}.${getCursorKey(jobType)}`, edges[edges.length - 1].cursor)
    const { removeOnComplete, removeOnFail } = job.opts
    queue.add(job.data, { removeOnComplete, removeOnFail })
  } else {
    const pendingRepos = getPendingRepos(subscription)
    if (pendingRepos.length === 0) {
      subscription.set('syncStatus', 'COMPLETE')
      app.log(`Sync status for installationId=${installationId} is complete`)
      try {
        await jiraClient.devinfo.migration.complete()
      } catch (err) {
        app.log.error(err || 'Error sending the `complete` event to JIRA')
      }
    } else {
      app.log(`Sync status for installationId=${installationId} is active. Pending jobs: ${JSON.stringify(pendingRepos, null, 2)}`)
    }
  }
  await subscription.save()
}
