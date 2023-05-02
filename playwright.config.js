const { devices } = require("@playwright/test");

module.exports = {
	testDir: `${__dirname}/test/e2e`,
	testMatch: /.*\.e2e\.ts/,
	outputDir: `${__dirname}/test/e2e/test-results`,
	use: {
		trace: "retain-on-failure",
		video: "retain-on-failure",
		screenshot: "only-on-failure"
	},
	timeout: 90000,
	globalSetup: `${__dirname}/test/e2e/setup.ts`,
	globalTeardown: `${__dirname}/test/e2e/teardown.ts`,
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
