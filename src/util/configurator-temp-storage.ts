import IORedis from "ioredis";
import { getRedisInfo } from "config/redis-info";

/* const config = {
	step1: {
		state: "completed",
		data: {
			serverName: "abc.atlassian.net"
		}
	},
	step2: {
		state: "inprogress",
		data: {
			oauth: "pending"
		}
	}
}; */

export interface Configurator {
	step1?: {
		state: string,
		data: any;
	},
	step2?: {
		state: string,
		data: any;
	},
	step3?: {
		state: string,
		data: any;
	}
}

const REDIS_CLEANUP_TIMEOUT = 7 * 24 * 3600 * 1000;

const redis = new IORedis(getRedisInfo("ConfiguratorTempStorage"));

export class ConfiguratorTempStorage {

	static async store(config: Configurator, installationId: number, jiraHost: string): Promise<string> {
		const key = this.toRedisKey(jiraHost, installationId);
		await redis.set(key, JSON.stringify(config), "px", REDIS_CLEANUP_TIMEOUT);
		return key;
	}

	static async get(jiraHost: string, installationId: number): Promise<Configurator | null> {
		const config = await redis.get(this.toRedisKey(jiraHost, installationId));
		if (!config) {
			return null;
		}
		return JSON.parse(config) as Configurator;
	}

	static async delete(uuid: string, installationId: number) {
		await redis.unlink(this.toRedisKey(uuid, installationId));
	}

	private static toRedisKey(jiraHost: string, installationId: number): string {
		return `configurator_${installationId}_${jiraHost}`;
	}
}


