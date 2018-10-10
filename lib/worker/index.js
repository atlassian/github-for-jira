const Queue = require('bull')
const { processSubscriptions } = require('../sync/subscriptions')

const app = require('./app')
const getJiraClient = require('../jira/client')

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

// Setup queues
const queues = {
  subscriptions: new Queue('Subscriptions', REDIS_URL),
  delayedJobs: new Queue('Delayed Jobs', REDIS_URL)
}

// Setup error handling for queues
Object.keys(queues).forEach(name => {
  const queue = queues[name]

  queue.on('error', (err) => {
    app.log.error({err, queue: name})
  })

  queue.on('failed', (job, err) => {
    app.log.error({job, err, queue: name})
  })
})

queues.subscriptions.on('completed', async (job, result) => {
  app.log('Subscriptions queue completed for job:', job.id)
  const { installationId, jiraHost, next } = job.data
  const nextJob = await queues.delayedJobs.getJob(`${installationId}:${next}`)
  console.log(nextJob)
  if (nextJob) {
    // Add the next job for this installation from delayedJobs into the active subscriptions queue
    await queues.subscriptions.add(
      { installationId, jiraHost, nodeId: nextJob.data.nodeId, next: nextJob.data.next },
      {
        jobId: `${installationId}:${nextJob.data.nodeId}`,
        removeOnComplete: false,
        removeOnFail: false
      }
    )
    // successfully added to the subscription queue, so remove from delayedJob queue.
    return nextJob.remove()
  } else {
    // no more jobs for this installationId, so tell Jjira to finish migration!
    const jiraClient = await getJiraClient(job.id, job.data.installationId, job.data.jiraHost)
    try {
      await jiraClient.devinfo.migration.complete()
    } catch (err) {
      app.log.error(err)
    }
  }
})

module.exports = {
  queues,

  async start () {
    queues.subscriptions.process(10, processSubscriptions(app, queues))

    app.log('Worker process started')
  },

  async clean () {
    return Promise.all([
      queues.subscriptions.clean(10000, 'completed'),
      queues.subscriptions.clean(10000, 'failed'),
      queues.delayedJobs.clean(10000, 'completed'),
      queues.delayedJobs.clean(10000, 'failed')
    ])
  },

  async stop () {
    return Promise.all([
      queues.subscriptions.close()
    ])
  }
}
