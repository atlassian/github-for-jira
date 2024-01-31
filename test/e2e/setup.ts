import { chromium } from "@playwright/test";
import { jiraAppInstall, jiraCreateProject, jiraLogin } from "test/e2e/utils/jira";
import { clearState, stateExists } from "test/e2e/e2e-utils";
import { testData } from "test/e2e/constants";
import { ngrokBypass } from "test/e2e/utils/ngrok";

export default async function setup() {
	// Remove old state before starting
	clearState();

	const browser = await chromium.launch();
	const page = await browser.newPage();

	// login and save state before tests
	await ngrokBypass(page);
	await jiraLogin(page, "admin", true);

	// Create global project
	await jiraAppInstall(page);
	await jiraCreateProject(page, testData.projectId());

	// Close the browser
	await browser.close();

	// Check to make sure state exists before continuing
	if (!stateExists(testData.jira.roles.admin) || !stateExists(testData.github.roles.admin)) {
		throw new Error("Missing state");
	}
}
