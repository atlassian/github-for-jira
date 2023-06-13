import { Request } from "express";
import IORedis from "ioredis";
import { getRedisInfo } from "config/redis-info";
import { v4 as newUUID } from "uuid";

export interface SubscriptionDeferredInstallPayload {
	installationIdPk: number,
	gitHubServerAppIdPk?: number,
	gitHubInstallationId: number,
	orgName: string
}

const redis = new IORedis(getRedisInfo("SubscriptionDeferredInstallService"));

const REDIS_CLEANUP_TIMEOUT = 2 * 24 * 3600 * 1000;

const toRedisKey = (requestId: string) => "sub_def_inst_serv_req}" + requestId;

const toRequestId = (req: Request) => req.params["requestId"];

export const extractSubscriptionDeferredInstallPayload = async (req: Request) => {
	try {
		const requestId = toRequestId(req);
		if (!requestId) {
			throw new Error("Empty request ID");
		}

		const request = await redis.get(toRedisKey(requestId));
		if (!request) {
			throw new Error("Unknown request");
		}

		const parsedPayload = JSON.parse(request) as SubscriptionDeferredInstallPayload;
		if (!parsedPayload.installationIdPk) {
			throw new Error("No installationIdPk");
		}

		if (!parsedPayload.gitHubInstallationId) {
			throw new Error("No gitHubInstallationId");
		}

		if (!parsedPayload.orgName) {
			throw new Error("No orgName");
		}

		return parsedPayload;
	} catch (err) {
		req.log.warn({ err }, "Cannot extract payload");
		throw err;
	}
};

export const registerSubscriptionDeferredInstallPayloadRequest = async (payload: SubscriptionDeferredInstallPayload) => {
	const key = newUUID();
	// We don't want to pollute redis, autoexpire after the flag is not being updated
	await redis.set(toRedisKey(key), JSON.stringify(payload), "px", REDIS_CLEANUP_TIMEOUT);
	return key;
};


export const forgetSubscriptionDeferredInstallRequest = async (req: Request) => {
	const requestId = toRequestId(req);
	if (requestId) {
		await redis.unlink(toRedisKey(requestId));
	}
};
