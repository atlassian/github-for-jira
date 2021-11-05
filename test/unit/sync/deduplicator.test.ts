import getRedisInfo from "../../../src/config/redis-info";
import {Deduplicator, DeduplicatorResult, RedisInProgressStorageWithTimeout} from "../../../src/sync/deduplicator";
import IORedis from "ioredis";

describe("deduplicator", () => {
	const redis = new IORedis(getRedisInfo("deduplicator-test" + new Date().toISOString()));
	let storage: RedisInProgressStorageWithTimeout;
	let key = "";
	beforeEach(() => {
		storage = new RedisInProgressStorageWithTimeout(redis);
		key = new Date().toISOString() + Math.random();
		jest.useFakeTimers("modern").setSystemTime(new Date("2020-01-01").getTime());
	})

	afterEach(() => {
		jest.useRealTimers();
	})

	describe("RedisInProgressStorageWithTimeout", () => {
		test("should setup and read the flag", async () => {
			await storage.setInProgressFlag(key, "foo");
			expect(await storage.hasInProgressFlag(key, 1000)).toEqual("foo");
		});

		test("should overwrite the previously set flag", async () => {
			await storage.setInProgressFlag(key, "foo");
			jest.advanceTimersByTime(50);
			await storage.setInProgressFlag(key, "bar");
			jest.advanceTimersByTime(60);
			expect(await storage.hasInProgressFlag(key, 100)).toEqual("bar");
		});

		test("should work with unknown flag", async () => {
			expect(await storage.hasInProgressFlag("not existing flag", 1000)).toBeNull();
		});

		test("should remove a flag", async () => {
			await storage.setInProgressFlag(key, "foo");
			await storage.removeInProgressFlag(key)
			expect(await storage.hasInProgressFlag(key, 100)).toBeNull();
		});

		test("should drop a flag after a timeout", async () => {
			await storage.setInProgressFlag(key, "foo");
			jest.advanceTimersByTime(50);
			expect(await storage.hasInProgressFlag(key, 10)).toBeNull();
		});

		describe("isJobRunnerLive", () => {

			test("should report live if another processes refreshes the flag", async () => {
				jest.useRealTimers();
				const redisGet = jest.fn();
				redisGet.mockResolvedValueOnce(JSON.stringify({
					jobRunnerId: "blah",
					timestamp: 0
				}));
				redisGet.mockResolvedValueOnce(JSON.stringify({
					jobRunnerId: "blah",
					timestamp: 100
				}));
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				const storage = new RedisInProgressStorageWithTimeout({
					get: redisGet
				} as IORedis.Redis);
				expect(await storage.isJobRunnerLive(key, "blah", 10)).toBeTruthy();
			});

			test("should not report live if flag is not moving", async () => {
				jest.useRealTimers();
				await storage.setInProgressFlag(key, "foo");
				expect(await storage.isJobRunnerLive(key, "foo", 1)).toBeFalsy();
			});

			test("should not report live if different jobRunnerId", async () => {
				await storage.setInProgressFlag(key, "foo");
				expect(await storage.isJobRunnerLive(key, "bar", 1)).toBeFalsy();
			});

			test("should not report live if no flag", async () => {
				expect(await storage.isJobRunnerLive(key, "foo", 1)).toBeFalsy();
			});

			test("shall not allow to wait for too long", async() => {
				jest.useRealTimers();
				await storage.setInProgressFlag(key, "foo");
				await expect(storage.isJobRunnerLive(key, "foo", 50_000)).toReject();
			});
		})

	});

	describe("Deduplicator", () => {

		test("should do the job if no flag found", async () => {
			expect(
				await new Deduplicator(storage, 100).executeWithDeduplication(key, () => Promise.resolve())
			).toBe(DeduplicatorResult.E_OK)
		});

		test("should setup the flag before kicking off the job", async () => {
			await new Deduplicator(storage, 100).executeWithDeduplication(key, async () => {
				const jobRunnerId = await storage.hasInProgressFlag(key, 100);
				expect(jobRunnerId).toContain("jobRunnerId");
				expect(jobRunnerId?.length || 0).toBeGreaterThan("jobRunnerId-".length)
				return Promise.resolve()
			})
		});

		test("should refresh the flag periodically", async () => {
			storage.setInProgressFlag = jest.fn();
			await new Deduplicator(storage, 1000).executeWithDeduplication(key, async () => {
				jest.advanceTimersByTime(60000);
				return Promise.resolve();
			})
			expect((storage.setInProgressFlag as jest.Mock).mock.calls.length).toBe(61);
		});

		test("should remove the flag when the job has finished with success", async () => {
			await new Deduplicator(storage, 100).executeWithDeduplication(key, () => Promise.resolve());
			expect(await storage.hasInProgressFlag(key, 1000)).toBeNull();
		});

		test("should remove the flag when the job finishes with a error", async () => {
			try {
				await new Deduplicator(storage, 100).executeWithDeduplication(key, () => Promise.reject("foo"));
				// eslint-disable-next-line no-empty
			} catch (_) { }
			expect(await storage.hasInProgressFlag(key, 1000)).toBeNull();
		});

		test("should propagate error upstream", async () => {
			let error: Error = new Error("blah");
			try {
				await new Deduplicator(storage, 100).executeWithDeduplication(key, () => Promise.reject(new Error("foo")));
			} catch (caughtError) {
				error = caughtError;
			}
			expect(error.message).toBe("foo");
		});

		test("should return NOT_SURE when flag exists but not moving", async () => {
			await storage.setInProgressFlag(key, "anotherJobRunnerId");
			storage.isJobRunnerLive = jest.fn().mockImplementation((jobKey: string, jobRunnerId: string, jobRunnerFlagUpdateTimeoutMsec: number) => {
				expect(jobKey).toBe(key);
				expect(jobRunnerId).toBe("anotherJobRunnerId");
				expect(jobRunnerFlagUpdateTimeoutMsec).toBe(2000);
				return Promise.resolve(false);
			})
			expect(
				await new Deduplicator(storage, 2000).executeWithDeduplication(key, () => Promise.resolve())
			).toBe(DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER)
		});

		test("should return OTHER_WORKER_DOING when flag exists but not moving", async () => {
			await storage.setInProgressFlag(key, "anotherJobRunnerId");
			storage.isJobRunnerLive = jest.fn().mockImplementation(() => {
				return Promise.resolve(true);
			})
			expect(
				await new Deduplicator(storage, 2000).executeWithDeduplication(key, () => Promise.resolve())
			).toBe(DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB)
		});
	});
});
