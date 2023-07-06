import Logger from "bunyan";
import IORedis from "ioredis";
import { getRedisInfo } from "config/redis-info";

const redis = new IORedis(getRedisInfo("backfill-msg-dedup"));

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

export const trySaveMessageToRedisForDedup = async (
	messageId: string | undefined,
	payload: string | null | undefined,
	visibilityTimeoutInMS: number,
	parentLogger: Logger
) => {

	let logger = parentLogger;

	try {

		logger = parentLogger.child({ jiraHost, visibilityTimeoutInMS });

		if (!messageId) {
			logger.warn("messageId is empty, shouldn't happen, ignore and return now for backfill msg dedeup");
			return;
		}

		if (isNaN(visibilityTimeoutInMS)) {
			logger.warn("visibilityTimeoutInSec is NaN, shouldn't happen, ignore and return now for backfill msg dedeup");
			return;
		}

		if (!payload) {
			logger.warn("Payload is empty, ignore backfill msg dedup");
			return;
		}

		const key = getkeyFromPayload(payload);

		//make the flag half of the visiblity timeout of the origin backfill msg
		//just so to be safe
		const dedupFlagAvailableInMS = Math.floor(visibilityTimeoutInMS / 2);
		const flagCreateTime = new Date().getTime();

		const result = await redis.set(key, JSON.stringify({ flagCreateTime, messageId }), "px", dedupFlagAvailableInMS);

		logger.info({ key, flagCreateTime, dedupFlagAvailableInMS, result }, "Flag for dedup backfill msg created");

	} catch (e) {
		logger.warn({ err: e }, "Failed at saving the backfill msg in redis for dedup, ignore it now");
	}

};

export const isBackfillMessagePresentAndValidAsSQSVisibilityHidden = async (
	messageId: string | undefined,
	payload: string | null | undefined,
	parentLogger: Logger
): Promise<boolean> => {

	let logger = parentLogger;

	try {

		logger = parentLogger.child({ jiraHost });

		if (!messageId) {
			logger.warn("messageId is empty, shouldn't happen, ignore and return now for backfill msg dedeup");
			return false;
		}

		if (!payload) {
			logger.warn("Payload is empty, ignore backfill msg dedup when looking up");
			return false;
		}

		const key = getkeyFromPayload(payload);

		const result = await redis.get(key);

		if (!result) {
			logger.info({ key }, "Duplicated backfill msg in visiblity hidden NOT FOUND, this msg doesn't have any duplication");
			return false;
		}

		const { flagCreateTime, messageId: messageIdInRedis } = JSON.parse(result);
		logger = logger.child({ key, result, flagCreateTime, messageId, messageIdInRedis });
		if (isNaN(flagCreateTime)) {
			logger.info ("Invalid flag creation time, can't verify, ignore the duplication check");
			return false;
		}

		if (messageId === messageIdInRedis) {
			logger.info("The current message is same message in redis, skip the dedup");
			return false;
		}

		const diffInMs = (new Date().getTime()) - flagCreateTime;
		if (diffInMs > TEN_MINUTES_IN_MS) {
			logger.info({ diffInMs }, "Last flag created more than ten minutes ago, ignore it");
			await redis.unlink(key);
			return false;
		}

		logger.info({ diffInMs }, "Flag for dedup backfill msg present and valid, return true to dedup the msg");
		return true;

	} catch (e) {
		logger.warn({ err: e }, "Failed at looking up the backfill msg in redis for dedup, ignore it now");
		return false;
	}

};

const getkeyFromPayload = (payload: string) => {
	/*
	 * Use the whole backfill msg (except for webhookId/metrics/startTime)
	 * as redis key for dedup, so that we are pretty sure that there's at least on msg
	 * in the visiblity timeout waiting to be process in the future
	 * an NO other worker processing the msg in the visiblity timeout (forbid by aws)
	 * So that we can in theory remove the current backfill msg
	 */
	const backfillMsg = JSON.parse(payload || "never-happen");
	return JSON.stringify({
		jiraHost: backfillMsg.jiraHost,
		installationId: backfillMsg.installationId,
		gitHubAppConfig: backfillMsg.gitHubAppConfig,
		syncType: backfillMsg.syncType,
		commitsFromDate: backfillMsg.commitsFromDate,
		targetTasks: backfillMsg.targetTasks
	});
};
