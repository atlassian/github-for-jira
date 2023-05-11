const { devices } = require("@playwright/test");

module.exports = {
	testDir: `${__dirname}/test/e2e`,
	testMatch: /.*\.e2e\.ts/,
	outputDir: `${__dirname}/test/e2e/test-results/tests`,
	use: {
		trace: "retain-on-failure",
		video: "retain-on-failure",
		screenshot: "only-on-failure"
	},
	timeout: 60000,
	globalSetup: `${__dirname}/test/e2e/setup.ts`,
	globalTeardown: `${__dirname}/test/e2e/teardown.ts`,
	// Fail the build on CI if you accidentally left test.only in the source code.
	forbidOnly: !!process.env.CI,
	// Opt out of parallel tests - this is because of the app installation test
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"]/*,
				storageState: `${__dirname}/test/e2e/test-results/states/default.json`*/
			}
		}
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
