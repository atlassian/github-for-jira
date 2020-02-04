const statsd = require('../config/statsd')
const { Subscription } = require('../../lib/models')

module.exports = async (job) => {
  const syncStatusCounts = await Subscription.syncStatusCounts()

  syncStatusCounts.forEach((row) => {
    statsd.gauge('syncs', row.count, { status: row.syncStatus })
  })

  const agedSyncCounts = await Subscription.agedSyncCounts()
  agedSyncCounts.forEach((row) => {
    statsd.gauge('aged_syncs_7d', row.count, { status: row.syncStatus })
  })
}
