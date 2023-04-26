import { GheConnectConfigTempStorage, resolveIntoConnectConfig } from "utils/ghe-connect-config-temp-storage";
import { DatabaseStateCreator } from "test/utils/database-state-creator";

const TEST_GHE_CONFIG = {
	serverUrl: "http://ghe.atlassian.com"
};

describe("ghe-config-temp-storage", () => {
	describe("GheConnectConfigTempStorage", () => {
		const storage = new GheConnectConfigTempStorage();

		it("should return uuid on save", async () => {
			const uuid = await storage.store(TEST_GHE_CONFIG, 1);
			const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i;
			expect(uuid).toMatch(uuidPattern);
		});

		it("should return the same value as was saved", async () => {
			const roundTripObj = await storage.get(await storage.store(TEST_GHE_CONFIG, 1), 1);
			expect(roundTripObj).toStrictEqual(TEST_GHE_CONFIG);
		});

		it("should return null when installation id differs", async () => {
			const roundTripObj = await storage.get(await storage.store(TEST_GHE_CONFIG, 1), 2);
			expect(roundTripObj).toBeNull();
		});

		it("should delete config object", async () => {
			const uuid = await storage.store(TEST_GHE_CONFIG, 1);
			await storage.delete(uuid, 1);
			expect(await storage.get(uuid, 1)).toBeNull();
		});
	});

	describe("resolveIntoConnectConfig", () => {

		it("resolves from database", async () => {
			const result = await new DatabaseStateCreator().forServer().create();
			expect((await resolveIntoConnectConfig(result.gitHubServerApp!.uuid, result.installation.id))!.serverUrl).toBeDefined();
			expect((await resolveIntoConnectConfig(result.gitHubServerApp!.uuid, result.installation.id))!.serverUrl).toStrictEqual(result.gitHubServerApp!.gitHubBaseUrl);
		});

		it("resolved from temp storage", async () => {
			const storage = new GheConnectConfigTempStorage();
			const uuid = await storage.store(TEST_GHE_CONFIG, 1);
			expect(await resolveIntoConnectConfig(uuid, 1)).toStrictEqual(TEST_GHE_CONFIG);
		});

		it("does not resolve from database when id is different", async () => {
			const result = await new DatabaseStateCreator().forServer().create();
			expect(await resolveIntoConnectConfig(result.gitHubServerApp!.uuid, result.installation.id + 1)).toBeUndefined();
		});

		it("does not resolve from temp storage when id is different", async () => {
			const storage = new GheConnectConfigTempStorage();
			const uuid = await storage.store(TEST_GHE_CONFIG, 1);
			expect(await resolveIntoConnectConfig(uuid, 2)).toBeUndefined();
		});
	});
});
