const Queue = require('bull')

const { processPullRequests } = require('../sync/pull-request')
const { processCommits } = require('../sync/commits.js')
const { processBranches } = require('../sync/branches.js')

const app = require('./app')

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

module.exports = {
  queues: {
    // Master queue used for passing data between web and workers
    master: new Queue('master', REDIS_URL),

    getForInstallation: (installationId) => {
      const name = `installation-${installationId}`
      if (this[name]) return this[name]

      const queue = new Queue(name, REDIS_URL, {
        // Run 1 job at a time every 5 seconds
        limiter: { max: 1, duration: 5000 }
      })

      queue.on('error', (err) => {
        app.log.error({err, queue: name})
      })

      queue.on('failed', (job, err) => {
        app.log.error({job, err, queue: name})
      })

      queue.on('global:completed', async () => {
        // This event is called when any job is completed
        // so check and see how many jobs are left
        // before closing the queue
        const count = await queue.count()
        if (count === 0) {
          queue.close().then(() => {
            app.log.info(`Queue for Installation-${installationId} closed`)
            delete this[name]
          })
        }
      })

      return queue
    }
  },

  start () {
    app.log('Worker process started')
    this.queues.master.process(job => {
      // Get a queue for this installation
      const queue = this.queues.getForInstallation(job.data.installationId)

      app.log(`Processing ${job.data.installationId} on ${queue.name}`)

      // Add commits branches and PR jobs to the queue
      queue.add('commits', job.data)
      queue.add('branches', job.data)
      queue.add('pull requests', job.data)
      // Named processors for each job type
      queue.process('commits', processCommits(app))
      queue.process('branches', processBranches(app))
      queue.process('pull requests', processPullRequests(app))
    })
  },

  async clean () {
    return Promise.all([
      this.queues.master.clean()
    ])
  },

  async stop () {
    return Promise.all([
      this.queues.master.close()
    ])
  }
}
