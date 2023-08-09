const mockedAnalyticsClient = {
	sendScreenEvent: jest.fn(),
	sendUIEvent: jest.fn(),
	sendTrackEvent: jest.fn()
};

global.SPA_APP_ENV = "";

module.exports = {
	default: function() { return mockedAnalyticsClient },
	mockedAnalyticsClient,
	tenantType: {
		CLOUD_ID: "CLOUD_ID"
	},
	userType: {
		ATLASSIAN_ACCOUNT: "ATLASSIAN_ACCOUNT"
	},
}

