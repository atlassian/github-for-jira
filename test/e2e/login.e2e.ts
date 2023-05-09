import { expect, test } from "@playwright/test";
import { jiraLogin } from "test/e2e/utils/jira";
import { githubLogin } from "test/e2e/utils/github";
import { testData } from "test/e2e/constants";

test.describe("Login", () => {
	for (const useState of [false, true]) {
		test.describe(useState ? "with state" : "without state", () => {
			test.describe("Jira", () => {
				if (useState) {
					test.use({
						storageState: testData.jira.roles.admin.state
					});
				}
				test("jiraLogin", async ({ page }) => {
					expect(await jiraLogin(page, "admin")).toBeTruthy();
				});
			});

			test.describe.skip("Github", () => {
				if (useState) {
					test.use({
						storageState: testData.github.roles.admin.state
					});
				}
				test("githubLogin", async ({ page }) => {
					expect(await githubLogin(page, "admin")).toBeTruthy();
				});
			});
		});
	}
});

