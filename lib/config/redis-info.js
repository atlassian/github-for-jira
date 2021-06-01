const url = require('url');
const logger = require('../../config/logger');

logger.info(`REDIS_BOTTLENECK_HOST: ${process.env.REDIS_BOTTLENECK_HOST}`);
logger.info(`REDIS_BOTTLENECK_PORT: ${process.env.REDIS_BOTTLENECK_PORT}`);

const REDIS_URL = process.env.REDIS_BOTTLENECK_HOST || '127.0.0.1';
const redisInfo = url.parse(REDIS_URL);
const REDIS_PORT = process.env.REDIS_BOTTLENECK_PORT || redisInfo.port || 6379;

logger.info(`REDIS_URL: ${process.env.REDIS_URL}`);
logger.info(`REDIS_PORT: ${process.env.REDIS_PORT}`);

/** @type {string} */
let password = null;
if (redisInfo.auth && redisInfo.auth.split(':').length === 2) {
  password = redisInfo.auth.split(':')[1];
}

/**
 * @param {string} connectionName - The name for the connection
 * @returns {{REDIS_URL: string, redisOptions: import('ioredis').RedisOptions}}
 */
module.exports = (connectionName) => ({
  REDIS_URL,
  redisOptions: {
    password,
    port: REDIS_PORT,
    host: REDIS_URL,
    db: redisInfo.pathname ? redisInfo.pathname.split('/')[1] : 0,
    connectionName,
  },
});
