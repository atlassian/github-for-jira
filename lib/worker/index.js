const Queue = require('bull')

const { discovery } = require('../sync/discovery')
const { processInstallation } = require('../sync/installation')

const app = require('./app')

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const { CONCURRENT_WORKERS = 1 } = process.env
const { Subscription } = require('../models')

// Setup queues
const queues = {
  discovery: new Queue('Content discovery', REDIS_URL),
  pullRequests: new Queue('Pull Requests transformation', REDIS_URL),
  commits: new Queue('Commit transformation', REDIS_URL),
  branches: new Queue('Branch transformation', REDIS_URL),
  installation: new Queue('Initial sync', REDIS_URL)
}

// Setup error handling for queues
Object.keys(queues).forEach(name => {
  const queue = queues[name]

  queue.on('error', (err) => {
    app.log.error({ err, queue: name })
  })

  queue.on('failed', async (job, err) => {
    app.log.error({ job, err, queue: name })
    const subscription = await Subscription.getSingleInstallation(job.jiraHost, job.installationId)
    await subscription.set('syncStatus', 'FAILED')
  })
})

const migrateJob = job => {
  const { installationId, jiraHost } = job
  queues.installation.add({ installationId, jiraHost })
}

module.exports = {
  queues,

  start () {
    queues.pullRequests.process(1, migrateJob)
    queues.commits.process(1, migrateJob)
    queues.branches.process(1, migrateJob)
    queues.discovery.process(5, discovery(app, queues))

    queues.installation.process(Number(CONCURRENT_WORKERS), processInstallation(app, queues))

    app.log(`Worker process started with ${CONCURRENT_WORKERS} CONCURRENT WORKERS`)
  },

  async clean () {
    return Promise.all([
      queues.discovery.clean(10000, 'completed'),
      queues.discovery.clean(10000, 'failed'),
      queues.pullRequests.clean(10000, 'completed'),
      queues.pullRequests.clean(10000, 'failed'),
      queues.commits.clean(10000, 'completed'),
      queues.commits.clean(10000, 'failed'),
      queues.branches.clean(10000, 'completed'),
      queues.branches.clean(10000, 'failed'),
      queues.installation.clean(10000, 'completed'),
      queues.installation.clean(10000, 'failed')
    ])
  },

  async stop () {
    return Promise.all([
      queues.pullRequests.close(),
      queues.commits.close(),
      queues.branches.close(),
      queues.discovery.close(),
      queues.installation.close()
    ])
  }
}
