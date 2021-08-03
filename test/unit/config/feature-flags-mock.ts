import crypto from "crypto";
import {mocked} from "ts-jest/utils";
import LaunchDarkly, {LDFlagValue, LDUser} from "launchdarkly-node-server-sdk";
import {initFeatureFlags} from "../../../src/config/feature-flags";

/**
 * Mocks the state of feature flags used by the featureFlags object in the
 * "feature-flags" module.
 *
 * Call withFlag() function to specify the value of a flag for a given jira hosts.
 * After setting as many feature flags as you want, call init() to initialize the
 * featureFlags object with the given feature flags state.
 *
 * Works only if you run jest.mock("launchdarkly-node-server-sdk"); in your
 * test file (I would have liked to pull that jest.mock() call into this class,
 * but it doesn't work when called from here).
 */
export class MockFeatureFlags {
	flags = {};

	/**
	 * Sets the state of the given feature flag for the given Jira host to a given value.
	 */
	withFlag(flag: string, jiraHost: string, value: boolean): MockFeatureFlags {
		const hash = crypto.createHash("sha1");
		hash.update(jiraHost)
		const userKey = hash.digest("hex");
		if (!this.flags[flag]) {
			this.flags[flag] = {};
		}
		this.flags[flag][userKey] = value;
		return this;
	}

	private mockLaunchDarklyClient() {
		return {

			// Mocks LDClient.variation() to return the value from the mocked feature flag state.
			variation: jest.fn().mockImplementation((flag: string, user: LDUser, defaultValue: LDFlagValue): Promise<LDFlagValue> => {
				if (!this.flags[flag]) {
					return defaultValue;
				}
				if (this.flags[flag][user.key] == undefined) {
					return defaultValue;
				}
				return Promise.resolve(this.flags[flag][user.key]);
			}),

			waitForInitialization: jest.fn().mockResolvedValue({})
		};
	}

	/**
	 * Must be called before asking the featureFlags object for the state of a feature flag.
	 */
	async init() {
		mocked(LaunchDarkly.init).mockReturnValue(this.mockLaunchDarklyClient() as never);
		await initFeatureFlags("THIS_IS_A_FAKE_KEY");
	}

}
