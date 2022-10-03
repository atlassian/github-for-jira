const { devices } = require("@playwright/test");

module.exports = {
	testDir: './test/e2e',
	testMatch: /.*\.e2e\.ts/,
	use: {
		trace: "on-first-retry",
	},
	timeout: 90000,
	globalSetup: './test/e2e/setup.ts',
	globalTeardown: './test/e2e/teardown.ts',
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
