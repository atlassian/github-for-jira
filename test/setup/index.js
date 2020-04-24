require('./env');
require('./testdouble');
require('./app');
require('./matchers/to-have-sent-metrics');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

beforeEach(async () => {
  await redis.flushdb();
});
