import { Redis } from "ioredis";
import { v4 as newUUID } from "uuid";

export interface GheConfig {
	serverUrl: string;

	// TODO: API key config will come here
	// apiKeyHeaderName: string | undefined;
	// encryptedApiKeyValue: string | undefined;
}

const REDIS_CLEANUP_TIMEOUT = 24 * 3600 * 1000;

export class GhtConfigTempStorage {

	private redis: Redis;

	constructor(redis: Redis) {
		this.redis = redis;
	}

	async store(config: GheConfig): Promise<string> {
		const key = newUUID();
		// We don't want to pollute redis, autoexpire after the flag is not being updated
		await this.redis.set(this.toRedisKey(key), JSON.stringify(config), "px", REDIS_CLEANUP_TIMEOUT);
		return key;
	}

	async get(uuid: string): Promise<GheConfig | null> {
		const config = await this.redis.get(this.toRedisKey(uuid));
		if (!config) {
			return null;
		}
		return JSON.parse(config) as GheConfig;
	}

	async delete(uuid: string) {
		await this.redis.unlink(this.toRedisKey(uuid));
	}

	private toRedisKey(uuid: string): string {
		return `ghe_config_${uuid}`;
	}
}

