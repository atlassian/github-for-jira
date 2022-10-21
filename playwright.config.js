const { devices } = require("@playwright/test");

module.exports = {
	testDir: "./test/e2e",
	testMatch: /.*\.e2e\.ts/,
	outputDir: "./test/e2e/test-results",
	use: {
		trace: "retain-on-failure",
		video: "retain-on-failure",
		screenshot: "only-on-failure"
	},
	timeout: 90000,
	globalSetup: "./test/e2e/setup.ts",
	globalTeardown: "./test/e2e/teardown.ts",
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				storageState: "./test/e2e/test-results/states/global.json"
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
