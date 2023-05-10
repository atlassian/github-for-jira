import { chromium } from "@playwright/test";
import { clearState } from "test/e2e/e2e-utils";
import { jiraAppUninstall, jiraRemoveProject } from "test/e2e/utils/jira";
import { testData } from "test/e2e/constants";

export default async function teardown() {
	const browser = await chromium.launch();
	const page = await browser.newPage({ storageState: testData.jira.roles.admin.state });
	await jiraRemoveProject(page, testData.projectId());
	// Uninstall the app
	await jiraAppUninstall(page);
	// Close the browser
	await browser.close();
	// Remove old state before starting
	clearState();
}
