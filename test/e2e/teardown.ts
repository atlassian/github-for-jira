import { chromium } from "@playwright/test";
import { clearState } from "test/e2e/e2e-utils";
import { ngrokBypass } from "test/e2e/utils/ngrok";
import { jiraAppUninstall, jiraLogin } from "test/e2e/utils/jira";

export default async function teardown() {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	// Remove old state before starting
	clearState();
	// login and save state before tests
	await ngrokBypass(page).then(async (page) => jiraLogin(page, "admin", true));
	// Uninstall the app
	await jiraAppUninstall(page);
	// Close the browser
	await browser.close();
}
