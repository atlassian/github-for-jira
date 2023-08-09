import { loadSoxAnalyticClient } from "./sox-analytics-client";
const { mockedAnalyticsClient } = require("@atlassiansox/analytics-web-client");

describe("Sox analytics client", () => {
	describe("UI Event", () => {
		it("should send proper track event", () => {
			const analyticsClient = loadSoxAnalyticClient();
			analyticsClient!.sendTrackEvent({ action: "success", actionSubject: "finishOAuthFlow", attributes: { hello: "world" }});
			expect(mockedAnalyticsClient.sendTrackEvent).toBeCalledWith({
				source: "spa",
				action: "success",
				actionSubject: "finishOAuthFlow",
				attributes: { hello: "world" }
			});
		});
		it("should send proper ui event", () => {
			const analyticsClient = loadSoxAnalyticClient();
			analyticsClient!.sendUIEvent({ action: "clicked", actionSubject: "authorizeTypeGitHubCloud", attributes: { abc: "efg" }});
			expect(mockedAnalyticsClient.sendUIEvent).toBeCalledWith({
				source: "spa",
				action: "clicked",
				actionSubject: "authorizeTypeGitHubCloud",
				attributes: { abc: "efg" }
			});
		});
		it("should send proper screen event", () => {
			const analyticsClient = loadSoxAnalyticClient();
			analyticsClient!.sendScreenEvent({ name: "AuthorisationScreen", attributes: { some: "thing" }});
			expect(mockedAnalyticsClient.sendScreenEvent).toBeCalledWith({
				name: "AuthorisationScreen",
				attributes: { some: "thing" }
			});
		});
	});
});
