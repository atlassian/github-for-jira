const url = require('url');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisInfo = url.parse(REDIS_URL);

/** @type {string} */
let password = null;
if (redisInfo.auth && redisInfo.auth.split(':').length === 2) {
  password = redisInfo.auth.split(':')[1];
}

function getRedisOptions(connectionName) {
  if (process.env.NODE_ENV === 'production') {
    return {
      REDIS_URL,
      redisOptions: {
        password: process.env.REDIS_PWD,
        port: process.env.REDIS_PORT || 6380,
        host: process.env.REDIS_HOST,
        db: redisInfo.pathname ? redisInfo.pathname.split('/')[1] : 0,
        tls: true,
        connectionName,
      },
    };
  } else {
    return {
      REDIS_URL,
      redisOptions: {
        password: process.env.REDIS_PWD,
        port: process.env.REDIS_PORT || 6379,
        host: process.env.REDIS_HOST || '127.0.0.1',
        db: redisInfo.pathname ? redisInfo.pathname.split('/')[1] : 0,
        connectionName,
      },
    };
  }
}

/**
 * @param {string} connectionName - The name for the connection
 * @returns {{REDIS_URL: string, redisOptions: import('ioredis').RedisOptions}}
 */
module.exports = (connectionName) => (
  getRedisOptions(connectionName)
);
