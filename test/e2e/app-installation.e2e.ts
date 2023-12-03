import { expect, test } from "@playwright/test";
import { jiraAppInstall, jiraAppUninstall } from "test/e2e/utils/jira";
import { testData } from "test/e2e/constants";
import { githubAppInstall, githubAppUninstall } from "test/e2e/utils/github";

test.describe("App Installation", () => {
	test.describe("jira", () => {
		test.use({
			storageState: testData.jira.roles.admin.state
		});

		test("jiraAppUninstall", async ({ page }) => {
			expect(await jiraAppUninstall(page)).toBeTruthy();
		});

		test("jiraAppInstall", async ({ page }) => {
			expect(await jiraAppInstall(page)).toBeTruthy();
		});
	});

	// Skipping because github isn't ready yet
	test.describe.skip("github", () => {
		test("githubAppInstall", async ({ page }) => {
			expect(await githubAppInstall(page)).toBeTruthy();
		});

		test("githubAppUninstall", async ({ page }) => {
			expect((await githubAppUninstall(page))).toBeTruthy();
		});
	});
});

