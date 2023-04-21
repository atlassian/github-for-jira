import IORedis  from "ioredis";
import { v4 as newUUID } from "uuid";
import { getRedisInfo } from "config/redis-info";
import { GitHubServerApp } from "models/github-server-app";

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

const redis = new IORedis(getRedisInfo("GheConnectConfigTempStorage"));

export class GheConnectConfigTempStorage {

	async store(config: GheConnectConfig): Promise<string> {
		const key = newUUID();
		// We don't want to pollute redis, autoexpire after the flag is not being updated
		await redis.set(this.toRedisKey(key), JSON.stringify(config), "px", REDIS_CLEANUP_TIMEOUT);
		return key;
	}

	async get(uuid: string): Promise<GheConnectConfig | null> {
		const config = await redis.get(this.toRedisKey(uuid));
		if (!config) {
			return null;
		}
		return JSON.parse(config) as GheConnectConfig;
	}

	async delete(uuid: string) {
		await redis.unlink(this.toRedisKey(uuid));
	}

	private toRedisKey(uuid: string): string {
		return `ghe_config_${uuid}`;
	}
}

/**
 * This first looks up the temp storage and then if not found checks the database (if there's already such
 * server with this UUID)
 * @param connectConfigUuidOrServerUuid
 */
export const resolveIntoConnectConfig = async (tempConnectConfigUuidOrServerUuid: string, installationId: number): Promise<GheConnectConfig | undefined> => {
	const connectConfig = await new GheConnectConfigTempStorage().get(tempConnectConfigUuidOrServerUuid);
	if (connectConfig) {
		return connectConfig;
	}
	const existingServer = await GitHubServerApp.findForUuid(tempConnectConfigUuidOrServerUuid);
	if (existingServer && existingServer.installationId === installationId) {
		return {
			serverUrl: existingServer.gitHubBaseUrl
			// TODO: add API key data
		};
	}
	return undefined;
};

