const statsd = require('../config/statsd')
const { Subscription } = require('../../lib/models')

module.exports = async (job) => {
  const syncStatusCounts = await Subscription.syncStatusCounts()

  syncStatusCounts.forEach((row) => {
    statsd.gauge('syncs', row.count, { status: row.syncStatus })
  })
}
