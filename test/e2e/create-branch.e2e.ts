import { expect, test } from "@playwright/test";
import { jiraCreateIssue, jiraEnsureAppInstalled, jiraRemoveIssue } from "test/e2e/utils/jira";
import { testData } from "test/e2e/constants";

test.describe("Create branch", () => {
	test.use({
		storageState: testData.jira.roles.admin.state
	});

	let issueId: string;
	// Create a fresh issue per test
	test.beforeEach(async ({ page }) => {
		issueId = await jiraCreateIssue(page);
	});

	test.afterEach(async ({ page }) => {
		await jiraRemoveIssue(page, issueId);
	});

	test("When there are no GitHub connections", async ({ page, context }) => {
		await jiraEnsureAppInstalled(page);
		await page.goto(testData.jira.urls.browse(issueId));
		// It is important to call waitForEvent first.
		const pagePromise = context.waitForEvent("page");
		// await page.locator("[data-testid='development-summary-branch.ui.create-branch-dropdown.link-item']").click();
		await page.locator("[data-testid='development-summary-branch.ui.summary-item'] [data-testid='development-summary-common.ui.summary-item.link-formatted-button']").click();
		const newTab = await pagePromise;
		expect(await newTab.locator("[id='noConfiguration__ConnectToGH']").isVisible()).toBeTruthy();
		await newTab.close();
	});
});

