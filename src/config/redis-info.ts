import * as url from 'url';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisUrl = url.parse(REDIS_URL);

let password;
if (redisUrl.auth && redisUrl.auth.split(':').length === 2) {
  password = redisUrl.auth.split(':')[1];
}

const db = redisUrl.pathname?.split('/') || [];

export default (connectionName: string): RedisInfo => ({
  redisUrl: REDIS_URL,
  redisOptions: {
    password,
    port: Number(redisUrl.port) || 6379,
    host: redisUrl.hostname,
    db: db.length >= 2 ? Number(db[1]) : 0,
    connectionName,
  },
});

interface RedisInfo {
  redisUrl: string;
  redisOptions: Redis.RedisOptions;
}
