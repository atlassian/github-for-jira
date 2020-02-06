const statsd = require('../config/statsd')
const { Subscription } = require('../../lib/models')

const ageThreshold = 7

module.exports = async (job) => {
  const syncStatusCounts = await Subscription.syncStatusCounts()
  syncStatusCounts.forEach((row) => {
    statsd.gauge('syncs', row.count, { status: row.syncStatus })
  })

  const agedSyncCounts = await Subscription.agedSyncCounts(`${ageThreshold} days`)
  agedSyncCounts.forEach((row) => {
    statsd.gauge(`aged_syncs_${ageThreshold}d`, row.count, { status: row.syncStatus })
  })
}
