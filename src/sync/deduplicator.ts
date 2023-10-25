import { Redis } from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { getLogger } from "config/logger";

/**
 *
 * The generic idea of the Deduplicator(tm) is very simple: while executing the job, Deduplicator raises a flag (in redis)
 * to inform other job runners not to run the same job ("same"-ness is defined by a key). At the end of the execution it
 * removes the previously raised flag.
 *
 * As all "very simple" ideas, it has several challenges, namely:
 *
 * THE FIRST CHALLENGE is: what if the worker dies (e.g. the EC2 node is rotated) during the execution? This might
 * have a flag raised but not being deleted.
 *
 * The implemented solution: save the timestamp of the flag and keep updating it in the job runner while it is doing its
 * job. If it dies, the flag will be invalidated in some reasonable time.
 *
 * THE SECOND CHALLENGE is: let's say a job runner observes the flag, what should it do? Reschedule the job or drop it?
 *
 * Always rescheduling is bad: if we have the issue with duplicates, this will keep queue increasing, not good for Redis'
 * CPU.
 *
 * Always dropping is dangerous: what if the flag belongs to a "dead" worker, however it wasn't invalidated yet?
 *
 * The implemented solution: once the worker observes the flag of a concurrent worker, it will watch for it for
 * some period of time and if it is moving (timestamp is being updated, which means the worker is doing "something"),
 * we are safe to discard the job as a detected duplicate; however if it is not moving it is dangerous to discard it
 * and should be rescheduled instead.
 *
 */


type InProgressStorage = {

	/**
	 * During the processing of a job, the worker should be calling this method regularly with the same workerId, thus
	 * informing other workers not to run potentially duplicating jobs.
	 *
	 * @param jobKey - a key of the job to be used for "deduplication", e.g. installationId
	 * @param workerId
	 */
	setInProgressFlag: (jobKey: string, jobRunnerId: string) => Promise<void>;

	/**
	 * Should be called when the worker finishes its execution of the job
	 *
	 * @param jobKey - a key of the job to be used for "deduplication", e.g. installationId
	 */
	removeInProgressFlag: (jobKey: string) => Promise<void>;

	/**
	 * Should be called by worker to figure out if there's currently already a job running or not. Yes - check
	 * the status of it (see isWorkerLiveLive), no - feel free to run it.
	 *
	 * @param jobKey - a key of the job to be used for "deduplication", e.g. installationId
	 * @param invalidatingTimestamp - time after which the flag is considered stale and can be ignored
	 * 											(a use-case is when a node dies during the execution of the job)
	 * @return previously set workerId if the flag is raised
	 */
	hasInProgressFlag: (jobKey: string, invalidatingTimestamp: number) => Promise<string | null>

	/**
	 *
	 * @param jobKey - a key of the job to be used for "deduplication", e.g. installationId
	 * @param jobRunnerId - the ID of the worker to watch for
	 * @param jobRunnerFlagUpdateTimeoutMsecs - the timeout which worker uses to update the flag with, the value is
	 * 																				 used to calculate the sleep interval between observations of the flag
	 *																				 during the execution.
	 *
	 * @return true if and only if can 100% tell that the execution with the given ID  is during something (the process is
	 * live), false otherwise (it might be still live but we couldn't determine that)
	 */
	isJobRunnerLive: (jobKey: string, jobRunnerId: string, jobRunnerFlagUpdateTimeoutMsecs: number) => Promise<boolean>;
}

const sleep = (ms: number) => {
	return new Promise(resolve => setTimeout(resolve, ms));
};

type Flag = {
	jobRunnerId: string,
	timestamp: number
};

export class RedisInProgressStorageWithTimeout implements InProgressStorage {
	private redis: Redis;

	constructor(redis: Redis) {
		this.redis = redis;
	}

	async hasInProgressFlag(jobKey: string, invalidatingTimestamp: number): Promise<string | null> {
		return this.redis.get(jobKey).then(json => {
			if (!json) {
				return null;
			}
			const flag = JSON.parse(json) as Flag;
			const isStaled = (Date.now() - flag.timestamp) >= invalidatingTimestamp;
			if (isStaled) {
				return null;
			}
			return flag.jobRunnerId;
		});
	}

	async removeInProgressFlag(jobKey: string): Promise<void> {
		await this.redis.unlink(jobKey);
	}

	async setInProgressFlag(jobKey: string, jobRunnerId: string): Promise<void> {
		const flag: Flag = {
			jobRunnerId: jobRunnerId,
			timestamp: Date.now()
		};
		// We don't want to pollute redis, autoexpire after the flag is not being updated
		const REDIS_CLEANUP_TIMEOUT = 24 * 3600 * 1000;
		await this.redis.set(jobKey, JSON.stringify(flag), "px", REDIS_CLEANUP_TIMEOUT);
	}

	async isJobRunnerLive(jobKey: string, jobRunnerId: string, jobRunnerFlagUpdateTimeoutMsecs: number): Promise<boolean> {
		const flagOld = await this.redis.get(jobKey);
		if (!flagOld) {
			// Cannot tell, might have finished already (race condition)
			return false;
		}
		const flagOldParsed = JSON.parse(flagOld) as Flag;
		if (flagOldParsed.jobRunnerId !== jobRunnerId) {
			// Cannot tell, other node might have pick up the job and updated the flag
			return false;
		}

		if (jobRunnerFlagUpdateTimeoutMsecs > 5_000) {
			throw new Error("One shouldn't block the execution for too long!");
		}
		await sleep(jobRunnerFlagUpdateTimeoutMsecs * 2);

		const flagNew = await this.redis.get(jobKey);
		if (!flagNew) {
			// Cannot tell, might have been deleted by Redis during auto-expiration
			return false;
		}
		const flagNewParsed = JSON.parse(flagNew) as Flag;
		// The only condition when we can say for sure that something is processing the job
		return flagNewParsed.jobRunnerId === jobRunnerId && flagOldParsed.timestamp < flagNewParsed.timestamp;
	}
}

export enum DeduplicatorResult {
	E_OK,
	E_OTHER_WORKER_DOING_THIS_JOB,
	E_NOT_SURE_TRY_AGAIN_LATER
}

export class Deduplicator {
	private inProgressStorage: InProgressStorage;
	private jobRunnerFlagUpdateTimeoutMsecs: number;

	constructor(inProgressStorage: InProgressStorage, jobRunnerFlagUpdateTimeoutMsecs: number) {
		this.inProgressStorage = inProgressStorage;
		this.jobRunnerFlagUpdateTimeoutMsecs = Math.min(jobRunnerFlagUpdateTimeoutMsecs, 5_000);
	}

	/**
	 * Executes the job if and only if it can determine that there's no other worker running the job (by checking the
	 * flag in the storage). If it can't tell and there's a flag, tries to understand if that other worker is live or
	 * this is some weird state.
	 *
	 * During the execution, refreshes the flag each jobRunnerFlagUpdateTimeoutMsecs to keep other workers informed.
	 *
	 * Based on the outcome of the call, you might decide to do the following:
	 * 	E_OK - the job has been processed, the flag was dropped, ANOTHER JOB with the same key can be scheduled and
	 * 				 it WILL BE PROCESSED NEXT
	 *  E_OTHER_WORKER_DOING_THIS_JOB - we have determined that the current task has been processed right now,
	 *  																you might want to DISCARD the job to avoid duplication
	 *  E_UNSURE_TRY_AGAIN_LATER - we are not sure if the other process is processing the job right now or not; you might like to
	 *  					  						   RESCHEDULE the task for good (remember there's a timeout for the flag)
	 *  <an exception is thrown> - same as E_OK with the only difference that the underlying job threw an exception; the
	 *  													 flag was removed.
	 */
	async executeWithDeduplication(jobKey: string, jobRunner: () => Promise<void>): Promise<DeduplicatorResult> {
		const jobRunnerId = "jobRunnerId-" + uuidv4();

		const inProgressFlagWorkerId = await this.inProgressStorage.hasInProgressFlag(jobKey, this.jobRunnerFlagUpdateTimeoutMsecs * 10);
		if (inProgressFlagWorkerId) {
			if (await this.inProgressStorage.isJobRunnerLive(jobKey, inProgressFlagWorkerId, this.jobRunnerFlagUpdateTimeoutMsecs)) {
				return DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB;
			}
			return DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER;
		}

		await this.inProgressStorage.setInProgressFlag(jobKey, jobRunnerId);
		const intervalIdx = setInterval(() => {
			this.inProgressStorage.setInProgressFlag(jobKey, jobRunnerId).catch(err => {
				getLogger("error").error({ err }, "Failed to update the flag");
			});
		}, this.jobRunnerFlagUpdateTimeoutMsecs);

		try {
			await jobRunner();
			return DeduplicatorResult.E_OK;
		} finally {
			clearInterval(intervalIdx);
			await this.inProgressStorage.removeInProgressFlag(jobKey);
		}
	}
}
