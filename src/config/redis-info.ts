import IORedis from "ioredis";
import { isNodeProd } from "utils/is-node-env";
import { envVars } from "config/env";

export const getRedisInfo = (connectionName: string): IORedis.RedisOptions => ({
	port: Number(envVars.REDISX_CACHE_PORT) || 6379,
	host: envVars.REDISX_CACHE_HOST || "127.0.0.1",
	db: 0,
	reconnectOnError(err) {
		const targetError = "READONLY";

		if (err.message.includes(targetError)) {
			return 1;
		}
		return false;
	},
	// TODO find out if we still need these options
	// https://github.com/OptimalBits/bull/issues/1873#issuecomment-950873766
	maxRetriesPerRequest: null,
	enableReadyCheck: false,

	tls: isNodeProd() || envVars.REDISX_CACHE_TLS_ENABLED ? { checkServerIdentity: () => undefined } : undefined,
	connectionName
});
