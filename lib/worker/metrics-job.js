const statsd = require('../config/statsd')
const { Subscription } = require('../../lib/models')

const ageThreshold = 7

module.exports = async (job) => {
  Promise.all([
    Subscription.syncStatusCounts(),
    Subscription.agedSyncCounts(`${ageThreshold} days`),
  ]).then((values) => {
    const [syncCounts, agedCounts] = values;
    syncCounts.forEach((row) => {
      statsd.gauge('syncs', row.count, { status: row.syncStatus })
    })
    agedCounts.forEach((row) => {
      statsd.gauge(`aged_syncs_${ageThreshold}d`, row.count, { status: row.syncStatus })
    })
  })
}
