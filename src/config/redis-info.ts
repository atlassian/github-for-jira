import Redis from "ioredis";

export default (connectionName: string): RedisInfo => ({
	redisOptions: {
		port: Number(process.env.REDIS_BOTTLENECK_PORT) || 6379,
		host: process.env.REDIS_BOTTLENECK_HOST || "127.0.0.1",
		db: 0,
		connectionName
	}
});

interface RedisInfo {
	redisOptions: Redis.RedisOptions;
}
