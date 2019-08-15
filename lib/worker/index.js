const Queue = require('bull')
const Sentry = require('@sentry/node')

const { discovery } = require('../sync/discovery')
const { processInstallation } = require('../sync/installation')
const { processPush } = require('../transforms/push')

const limiterPerInstallation = require('./limiter')

const app = require('./app')

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const { CONCURRENT_WORKERS = 1 } = process.env
const { Subscription } = require('../models')

// Setup queues
const queues = {
  discovery: new Queue('Content discovery', REDIS_URL),
  installation: new Queue('Initial sync', REDIS_URL),
  push: new Queue('Push transformation', REDIS_URL)
}

// Setup error handling for queues
Object.keys(queues).forEach(name => {
  const queue = queues[name]

  queue.on('error', (err) => {
    Sentry.setContext('Queue Context', { queue })
    Sentry.setTag('queue', name)
    Sentry.captureException(err)
  })

  queue.on('failed', async (job, err) => {
    Sentry.setContext('Queue Context', { queue, job })
    Sentry.setTag('queue', name)
    Sentry.captureException(err)

    const subscription = await Subscription.getSingleInstallation(job.data.jiraHost, job.data.installationId)
    await subscription.update({ syncStatus: 'FAILED' })
  })
})

module.exports = {
  queues,

  start () {
    queues.discovery.process(5, discovery(app, queues))
    queues.installation.process(Number(CONCURRENT_WORKERS), processInstallation(app, queues))
    queues.push.process(Number(CONCURRENT_WORKERS), limiterPerInstallation(processPush(app)))
    app.log(`Worker process started with ${CONCURRENT_WORKERS} CONCURRENT WORKERS`)
  },

  async clean () {
    return Promise.all([
      queues.discovery.clean(10000, 'completed'),
      queues.discovery.clean(10000, 'failed'),
      queues.installation.clean(10000, 'completed'),
      queues.installation.clean(10000, 'failed'),
      queues.push.clean(10000, 'completed'),
      queues.push.clean(10000, 'failed')
    ])
  },

  async stop () {
    return Promise.all([
      queues.discovery.close(),
      queues.installation.close(),
      queues.push.close()
    ])
  }
}
