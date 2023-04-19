import { Redis } from "ioredis";
import { v4 as newUUID } from "uuid";

/**
 * Contains minimum set of parameters that are needed to reach a GHE server. It might return 401, we don't care,
 * important bit is that there's a connectivity between the app and the GHE.
 */
export interface GheConnectConfig {
	serverUrl: string;

	// TODO: API key config will come here
	// apiKeyHeaderName: string | undefined;
	// encryptedApiKeyValue: string | undefined;
}

const REDIS_CLEANUP_TIMEOUT = 24 * 3600 * 1000;

export class GheConnectConfigTempStorage {

	private redis: Redis;

	constructor(redis: Redis) {
		this.redis = redis;
	}

	async store(config: GheConnectConfig): Promise<string> {
		const key = newUUID();
		// We don't want to pollute redis, autoexpire after the flag is not being updated
		await this.redis.set(this.toRedisKey(key), JSON.stringify(config), "px", REDIS_CLEANUP_TIMEOUT);
		return key;
	}

	async get(uuid: string): Promise<GheConnectConfig | null> {
		const config = await this.redis.get(this.toRedisKey(uuid));
		if (!config) {
			return null;
		}
		return JSON.parse(config) as GheConnectConfig;
	}

	async delete(uuid: string) {
		await this.redis.unlink(this.toRedisKey(uuid));
	}

	private toRedisKey(uuid: string): string {
		return `ghe_config_${uuid}`;
	}
}

