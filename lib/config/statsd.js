const StatsD = require('hot-shots');

/** @type {import('hot-shots').StatsD} */
module.exports = new StatsD({
  prefix: 'jira-integration.',
  mock: process.env.NODE_ENV === 'test',
  globalTags: { env: process.env.NODE_ENV || 'unknown' },
});
