const { devices } = require("@playwright/test");

module.exports = {
	testDir: './test/e2e',
	testMatch: /.*\.e2e\.ts/,

	use: {
		headless: false,
		trace: "on-first-retry",
		// Tell all tests to load signed-in state from 'storageState.json'.
		storageState: 'storageState.json'
	},
	globalSetup: require.resolve('./test/e2e/setup'),
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] }
		},
		/*{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] }
		},
		{
			name: "webkit",
			use: { ...devices["Desktop Safari"] }
		}*/
	]
};
