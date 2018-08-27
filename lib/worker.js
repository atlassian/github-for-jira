const Queue = require('bull')

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

module.exports = {
  queues: {
    discovery: new Queue('Content discovery', REDIS_URL),
    pullRequests: new Queue('Pull Requests transformation', REDIS_URL),
    commits: new Queue('Commit transformation', REDIS_URL)
  },

  start () {
    console.log('Starting worker process')
  }
}
