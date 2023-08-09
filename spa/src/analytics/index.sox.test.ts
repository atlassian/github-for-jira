import analyticsClient from "./index";

function getMockedSoxClient() {

	if ((global as any).mockedSoxClient) {
		return (global as any).mockedSoxClient;
	}

	(global as any).mockedSoxClient = {
		sendUIEvent: jest.fn(),
		sendScreenEvent: jest.fn(),
		sendTrackEvent: jest.fn()
	}
	return (global as any).mockedSoxClient;
}

jest.mock("./sox-analytics-client", () => ({ loadSoxAnalyticClient: getMockedSoxClient }))

describe("Analytics Sox Client", () => {
	it("should use sox client when dependency found", () => {
		analyticsClient.sendUIEvent({ action: "clicked", actionSubject: "authorizeTypeGitHubCloud" });
		expect(getMockedSoxClient().sendUIEvent).toBeCalled();
	});
});
