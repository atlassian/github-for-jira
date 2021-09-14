import Redis from "ioredis";
import { isNodeProd } from "../util/isNodeEnv";

export default (connectionName: string): Redis.RedisOptions => ({
	port: Number(process.env.REDISX_CACHE_PORT) || 6379,
	host: process.env.REDISX_CACHE_HOST || "127.0.0.1",
	db: 0,
	tls: isNodeProd() ? { checkServerIdentity: () => undefined } : undefined,
	connectionName
});
