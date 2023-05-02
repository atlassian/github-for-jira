import { expect, test } from "@playwright/test";
import { jiraAddProject, jiraCreateIssue, jiraLogin, jiraRemoveProject } from "test/e2e/utils/jira";
import { testData } from "test/e2e/constants";

test.describe("Create branch", () => {
	let projectId: string;

	test.use({
		storageState: testData.jira.roles.admin.state
	});

	test.beforeAll(async ({ page }) => {
		await jiraLogin(page, "admin");
		projectId = await jiraAddProject(page);
	});

	// Clean up projects to avoid conflicts in future
	test.afterAll(async ({ page }) => {
		await jiraRemoveProject(page, projectId);
	});

	test.describe("cloud", () => {
		// Create a fresh issue per test
		test.beforeEach(async ({ page }) => {
			await jiraCreateIssue(page, projectId);
		});

		test("When there are no GitHub connections", async ({ page }) => {
			await page.goto(testData.jira.urls.testProjectIssue);
			const [popup] = await Promise.all([
				// It is important to call waitForEvent first.
				page.waitForEvent("popup"),
				// Opens the popup.
				page.locator("a[data-testid='development-summary-common.ui.summary-item.link-formatted-button']").click()
			]);
			await popup.waitForLoadState();
			expect(popup.getByText("Almost there!")).toBeTruthy();
			await popup.close();
		});
	});
});

