import url from 'url';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_BOTTLENECK_HOST || '127.0.0.1';
const redisInfo = url.parse(REDIS_URL);
const REDIS_PORT = process.env.REDIS_BOTTLENECK_PORT || redisInfo.port || 6379;

let password;
if (redisInfo.auth?.split(':').length === 2) {
  password = redisInfo.auth.split(':')[1];
}

const db = redisInfo.pathname?.split('/') || [];

/**
 * @param {string} connectionName - The name for the connection
 * @returns {{REDIS_URL: string, redisOptions: import('ioredis').RedisOptions}}
 */
export default (connectionName: string): RedisInfo => ({
  redisUrl: REDIS_URL,
  redisOptions: {
    password,
    port: Number(REDIS_PORT) || 6379,
    host: REDIS_URL,
    db: db.length >= 2 ? Number(db[1]) : 0,
    connectionName,
  },
});

interface RedisInfo {
  redisUrl: string;
  redisOptions: Redis.RedisOptions;
}
