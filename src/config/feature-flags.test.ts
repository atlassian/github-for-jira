import LaunchDarkly, { LDClient } from "launchdarkly-node-server-sdk";
import { mocked } from "ts-jest/utils";
import { getLogger } from "config/logger";

jest.mock("launchdarkly-node-server-sdk");

describe("Feature Flag", () => {

	let featureFlags;

	const mockFeatureFlagValue = async (flagValue: boolean) => {
		mocked(LaunchDarkly.init).mockReturnValue(({
			variation: jest.fn().mockResolvedValue(flagValue),
			waitForInitialization: jest.fn().mockResolvedValue({})
		} as unknown) as LDClient);

		// We're importing featureFlags only after mocking LaunchDarkly.init(), so
		// that LaunchDarkly.init() is called on the mock and not on the real thing.
		featureFlags = await import("./feature-flags");
	};

	it("returns true when LaunchDarkly returns true", async () => {
		await mockFeatureFlagValue(true);
		expect(await featureFlags.booleanFlag(featureFlags.BooleanFlags.MAINTENANCE_MODE, "https://myjira.atlassian.net")).toBeTruthy();
	});

	it("returns false when LaunchDarkly returns false", async () => {
		await mockFeatureFlagValue(false);
		expect(await featureFlags.booleanFlag(featureFlags.BooleanFlags.MAINTENANCE_MODE, "https://myjira.atlassian.net")).toBeFalsy();
	});

});

describe("shouldSendAll", () => {
	let featureFlags;
	const logger = getLogger("real-fake-logger");

	const mockFeatureFlagValue = async (flagValue: string) => {
		mocked(LaunchDarkly.init).mockReturnValue({
			variation: jest.fn().mockResolvedValue(flagValue),
			waitForInitialization: jest.fn().mockResolvedValue({})
		} as unknown as LDClient);

		// Import featureFlags only after mocking LaunchDarkly.init()!!
		featureFlags = await import("./feature-flags");

	};

	it("returns true when SendAll flag includes the specified type", async () => {
		await mockFeatureFlagValue('["branches-backfill", "builds"]');

		expect(await featureFlags.shouldSendAll("branches-backfill", "https://myjira.atlassian.net", logger)).toBeTruthy();
	});

	it("returns false when SendAll falg defaults to empty", async () => {
		await mockFeatureFlagValue("[]");

		expect(await featureFlags.shouldSendAll("commits-backfill", "https://myjira.atlassian.net", logger)).toBeFalsy();
	});

	it("returns false when SendAll does not include the specified type", async () => {
		await mockFeatureFlagValue('["banana"]');

		expect(await featureFlags.shouldSendAll("commits-backfill", "https://myjira.atlassian.net", logger)).toBeFalsy();
	});

	it("handles JSON parsing errors and returns false", async () => {
		await mockFeatureFlagValue("invalid-json");

		expect(await featureFlags.shouldSendAll("branches-backfill", "https://myjira.atlassian.net", logger)).toBeFalsy();
	});

});
