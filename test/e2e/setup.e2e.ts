import { expect, test } from "@playwright/test";
import { jiraAppInstall, jiraAppUninstall, jiraLogin } from "test/e2e/utils/jira";
import { githubLogin } from "test/e2e/utils/github";
import { testData } from "test/e2e/constants";

test.describe("setup functions", () => {
	test.describe("jira", () => {
		test.setTimeout(90000);
		for (const useState of [false, true]) {
			test.describe(useState ? "with state" : "without state", () => {
				if (useState) {
					test.use({
						storageState: testData.jira.roles.admin.storage
					});

					test.beforeAll(async ({ page }) => {
						// login and save state before tests
						await jiraLogin(page, "admin");
					});
				}

				test("jiraLogin", async ({ page }) => {
					expect(await jiraLogin(page, "admin")).toBeTruthy();
				});

				test("jiraAppInstall", async ({ page }) => {
					expect(await jiraAppInstall(page)).toBeTruthy();
				});

				test("jiraAppUninstall", async ({ page }) => {
					expect(await jiraAppUninstall(page)).toBeTruthy();
				});
			});
		}
	});

	test.describe("github", () => {
		test("githubLogin", async ({ page }) => {
			expect(await githubLogin(page, "admin")).toBeTruthy();
		});
		/*
				test("githubAppInstall", async ({ page }) => {
					expect(await githubAppInstall(page)).toBeTruthy();
				});

				test("githubAppUninstall", async ({ page }) => {
					expect(await githubAppUninstall(page)).toBeTruthy();
				});*/
	});
});

