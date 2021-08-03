import {featureFlags} from "../../../src/config/feature-flags";
import {MockFeatureFlags} from "./feature-flags-mock";

jest.mock("launchdarkly-node-server-sdk");

describe("Feature Flags", () => {

	describe("Maintenance Mode", () => {

		it("is disabled by default", async () => {
			await new MockFeatureFlags().init();
			expect(await featureFlags.isMaintenanceMode("https://myjira.atlassian.net")).toBeFalsy();
		});

		it("is enabled for a given Jira host", async () => {
			await new MockFeatureFlags()
				.withFlag("maintenance-mode", "https://myjira.atlassian.net", true)
				.init();
			expect(await featureFlags.isMaintenanceMode("https://myjira.atlassian.net")).toBeTruthy();
		});

		it("is disabled for a given Jira host", async () => {
			await new MockFeatureFlags()
				.withFlag("maintenance-mode", "https://myjira.atlassian.net", false)
				.init();
			expect(await featureFlags.isMaintenanceMode("https://myjira.atlassian.net")).toBeFalsy();
		});

		it("is disabled for an unknown Jira host", async () => {
			await new MockFeatureFlags()
				.withFlag("maintenance-mode", "https://myjira.atlassian.net", true)
				.init();
			expect(await featureFlags.isMaintenanceMode("https://foo.atlassian.net")).toBeFalsy();
		});

	});

});
