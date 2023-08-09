import analyticsClient from "./index";
import { noopAnalyticsClient } from "./noop-analytics-client";

jest.mock("./sox-analytics-client");
jest.mock("./noop-analytics-client", () => ({
	noopAnalyticsClient: { sendUIEvent: jest.fn() }
}));

describe("Analytics Client", () => {
	describe("Missing optional dependency (sox client)", () => {
		it("should use noop analytics client", () => {
			analyticsClient.sendUIEvent({ action: "clicked", actionSubject: "authorizeTypeGitHubCloud" });
			expect(noopAnalyticsClient.sendUIEvent).toBeCalled();
		});
	});
});
