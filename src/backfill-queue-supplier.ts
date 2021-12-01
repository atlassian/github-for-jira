import Queue from "bull";
import {SqsQueue} from "./sqs";
import {BackfillMessagePayload} from "./sqs/backfill";
import {BackfillQueue} from "./sync/installation";
import {LoggerWithTarget} from "probot/lib/wrap-logger";
import {getLogger} from "./config/logger";
import {booleanFlag, BooleanFlags} from "./config/feature-flags";

const fallbackLogger = getLogger("queue-supplier-default");

/**
 * A temp class to support switching between Redis and SQS. Will be gone with the feature flag and the
 * Redis queue.
 */
class BackfillQueueSupplier {
	private redisQueue: Queue.Queue;
	private sqsQueue: SqsQueue<BackfillMessagePayload>;

	setRedisQueue(redisQueue: Queue.Queue) {
		this.redisQueue = redisQueue;
	}

	setSQSQueue(sqsQueue: SqsQueue<BackfillMessagePayload>) {
		this.sqsQueue = sqsQueue;
	}

	async supply(): Promise<BackfillQueue> {
		if (!this.redisQueue) {
			return Promise.reject(new Error("Redis queue wasn't provided"));
		}
		if (!this.sqsQueue) {
			return Promise.reject(new Error("SQS queue wasn't provided"));
		}
		return {
			schedule: async (payload, delayMsec?: number, log?: LoggerWithTarget) => {
				if (await booleanFlag(BooleanFlags.USE_SQS_FOR_BACKFILL, false, payload.jiraHost)) {
					await this.sqsQueue.sendMessage(payload, (delayMsec || 0) / 1000, (log || fallbackLogger));
				} else {
					if (delayMsec) {
						await this.redisQueue.add(payload, {delay: delayMsec});
					} else {
						await this.redisQueue.add(payload);
					}
				}
			}
		};
	}
}

export default new BackfillQueueSupplier();
