const statsd = require('../config/statsd');
const { Subscription } = require('../models');

module.exports = async () => {
  try {
    const syncStatusCounts = await Subscription.syncStatusCounts();

    syncStatusCounts.forEach((row) => {
      statsd.gauge('syncs', row.count, { status: row.syncStatus });
    });
  } catch (err) {
    logger.error(`Metrics error: ${err}`);
  }
};
