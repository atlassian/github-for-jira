import { chromium } from "@playwright/test";
import { jiraLogin } from "test/e2e/utils/jira";
// import { githubAppUpdateURLs, githubLogin } from "test/e2e/utils/github";
import { clearState, stateExists } from "test/e2e/e2e-utils";
import { testData } from "test/e2e/constants";

export default async function setup() {
	const browser = await chromium.launch();

	// Remove old state before starting
	clearState();

	// login and save state before tests
	const page = await browser.newPage();
	await Promise.all([
		jiraLogin(page, "admin", true)/*.finally(async () => await page.screenshot({ path: `${SCREENSHOT_PATH}/jira-login.jpg` }))*/
		// githubLogin(await browser.newPage(), "admin", true).then(githubAppUpdateURLs)
	]);

	// Close the browser
	await browser.close();

	// Check to make sure state exists before continuing
	if (!stateExists(testData.jira.roles.admin) || !stateExists(testData.github.roles.admin)) {
		throw "Missing state";
	}
}
