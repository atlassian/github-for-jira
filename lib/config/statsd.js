const StatsD = require('hot-shots')

module.exports = new StatsD({
  prefix: 'jira-integration.',
  globalTags: {
    env: process.env.NODE_ENV || 'unknown',
    dyno: process.env.DYNO || 'unknown'
  }
})
