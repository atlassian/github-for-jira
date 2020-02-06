const statsd = require('../config/statsd')
const { Subscription } = require('../../lib/models')

const ageThreshold = 7

function recordBin (bin, label) {
  bin.forEach((row) => {
    statsd.gauge(`aged_syncs_bins`, row.count, { status: row.syncStatus, bin: label })
  })
}

module.exports = async (job) => {
  Promise.all([
    Subscription.syncStatusCounts(),
    Subscription.agedSyncCounts(`${ageThreshold} days`),
    Subscription.agedSyncCounts('1 second', '2 hours'),
    Subscription.agedSyncCounts('2 hours', '6 hours'),
    Subscription.agedSyncCounts('6 hours', '24 hours'),
    Subscription.agedSyncCounts('1 day', '3 days'),
    Subscription.agedSyncCounts('3 day', '7 days'),
    Subscription.agedSyncCounts('7 days', '14 days'),
    Subscription.agedSyncCounts('14 days', '10 years') // 10 years is a placeholder for "the rest of history"
  ]).then((values) => {
    const [
      syncCounts,
      agedCounts,

      bin2Hour,
      bin6Hour,
      bin1day,
      bin3day,
      bin7day,
      bin14day,
      binOld
    ] = values

    syncCounts.forEach((row) => {
      statsd.gauge('syncs', row.count, { status: row.syncStatus })
    })
    agedCounts.forEach((row) => {
      statsd.gauge(`aged_syncs_${ageThreshold}d`, row.count, { status: row.syncStatus })
    })

    recordBin(bin2Hour, '1_2hour')
    recordBin(bin6Hour, '2_6hour')
    recordBin(bin1day, '3_1day')
    recordBin(bin3day, '4_3day')
    recordBin(bin7day, '5_7day')
    recordBin(bin14day, '6_14day')
    recordBin(binOld, '7_14dayplus')
  })
}
