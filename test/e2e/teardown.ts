// import { clearState } from "test/e2e/e2e-utils";

import { chromium } from "@playwright/test";
import { clearState } from "test/e2e/e2e-utils";
import { ngrokBypass } from "test/e2e/utils/ngrok";
import { jiraAppUninstall, jiraLogin } from "test/e2e/utils/jira";

export default async function teardown() {
	// Clear state at the end
	// clearState();
	const browser = await chromium.launch();
	const page = await browser.newPage();
	// Remove old state before starting
	clearState();

	// login and save state before tests
	await Promise.all([
		ngrokBypass(page).then(async (page) => jiraLogin(page, "admin", true))
		// githubLogin(await browser.newPage(), "admin", true).then(githubAppUpdateURLs)
	]);
	await jiraAppUninstall(page);
	// Close the browser
	await browser.close();

}
