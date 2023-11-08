import LaunchDarkly, { LDClient } from "launchdarkly-node-server-sdk";
import { mocked } from "jest-mock";

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
