import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_BOTTLENECK_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_BOTTLENECK_PORT || 6379;

export default (connectionName: string): RedisInfo => ({
  redisOptions: {
    port: Number(REDIS_PORT) || 6379,
    host: REDIS_URL,
    db: 0,
    connectionName,
  },
});

interface RedisInfo {
  redisOptions: Redis.RedisOptions;
}
