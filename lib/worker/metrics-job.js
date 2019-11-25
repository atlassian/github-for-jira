const statsd = require('../config/statsd');
const { Subscription } = require('../../lib/models');

module.exports = async () => {
  const syncStatusCounts = await Subscription.syncStatusCounts();

  syncStatusCounts.forEach((row) => {
    statsd.gauge('syncs', row.count, { status: row.syncStatus });
  });
};
