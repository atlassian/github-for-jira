import { getJiraId } from "./id";

describe("Jira ID", () => {
	it("should work", () => {
		expect(getJiraId("AP-3-large_push")).toEqual("AP-3-large_push");
		expect(getJiraId("AP-3-large_push/foobar")).toEqual(
			"~41502d332d6c617267655f707573682f666f6f626172"
		);
		expect(getJiraId("feature-something-cool")).toEqual(
			"feature-something-cool"
		);
		expect(getJiraId("feature/something-cool")).toEqual(
			"~666561747572652f736f6d657468696e672d636f6f6c"
		);
	});
});
