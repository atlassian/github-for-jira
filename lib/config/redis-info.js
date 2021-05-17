const url = require('url');

const REDIS_HOST = process.env.REDIS_CACHE_HOST || '127.0.0.1';
const redisInfo = url.parse(REDIS_HOST);
const REDIS_PORT = process.env.REDIS_CACHE_PORT || redisInfo.port || 6379;

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
  REDIS_URL: REDIS_HOST,
  redisOptions: {
    password,
    port: REDIS_PORT,
    host: REDIS_HOST,
    db: redisInfo.pathname ? redisInfo.pathname.split('/')[1] : 0,
    connectionName,
  },
});
