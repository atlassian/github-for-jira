import Queue from "bull";
import {SqsQueue} from "./sqs";
import {BackfillMessagePayload} from "./sqs/backfill";
import {BackfillQueue} from "./sync/installation";
import {LoggerWithTarget} from "probot/lib/wrap-logger";
import {getLogger} from "./config/logger";

const fallbackLogger = getLogger("queue-supplier-default");

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
				// TODO: add a feature flag switch + test
				await this.sqsQueue.sendMessage(payload, (delayMsec || 0) / 1000, (log || fallbackLogger));

				// if (delayMsec) {
				// 	await this.redisQueue.add(payload, {delay: delayMsec});
				// } else {
				// 	await this.redisQueue.add(payload);
				// }
			}
		};
	}
}

export default new BackfillQueueSupplier();
