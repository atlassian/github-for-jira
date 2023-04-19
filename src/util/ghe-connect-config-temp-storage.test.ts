import IORedis from "ioredis";
import { getRedisInfo } from "config/redis-info";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";

describe("ghe-config-temp-storage", () => {
	const redis = new IORedis(getRedisInfo("deduplicator-test" + new Date().toISOString()));
	const storage = new GheConnectConfigTempStorage(redis);

	const TEST_GHE_CONFIG = {
		serverUrl: "http://ghe.atlassian.com"
	};

	it("should return uuid on save", async () => {
		const uuid = await storage.store(TEST_GHE_CONFIG);
		const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i;
		expect(uuid).toMatch(uuidPattern);
	});

	it("should return the same value as was saved", async () => {
		const roundTripObj = await storage.get(await storage.store(TEST_GHE_CONFIG));
		expect(roundTripObj).toStrictEqual(TEST_GHE_CONFIG);
	});

	it("should delete config object", async () => {
		const uuid = await storage.store(TEST_GHE_CONFIG);
		await storage.delete(uuid);
		expect(await storage.get(uuid)).toBeNull();
	});
});
