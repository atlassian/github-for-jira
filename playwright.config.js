const { devices } = require("@playwright/test");

module.exports = {
	testDir: './test/e2e',
	testMatch: /.*\.e2e\.ts/,
	use: {
		trace: "on-first-retry",
		// Tell all tests to load signed-in state
		storageState: './test/e2e/.state.json'
	},
	globalSetup: './test/e2e/setup.ts',
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
