// import { expect, Page, test } from "@playwright/test";
// import { jiraAppInstall, jiraAppUninstall, jiraLogin } from "test/e2e/utils/jira";
// import { githubLogin } from "test/e2e/utils/github";
// import { testData } from "test/e2e/constants";
//
// test.describe("App Installation", () => {
// 	for (const useState of [false, true]) {
// 		test.describe("jira", () => {
// 			test.describe(useState ? "with state" : "without state", () => {
// 				if (useState) {
// 					test.use({
// 						storageState: testData.jira.roles.admin.state
// 					});
// 				}
//
// 				test("jiraLogin", async ({ page }) => {
// 					expect(await jiraLogin(page, "admin")).toBeTruthy();
// 				});
//
// 				test.describe("app", () => {
// 					let page: Page;
// 					test.beforeEach(async ({ page: newPage }) => {
// 						page = newPage;
// 						if (!useState) {
// 							await jiraLogin(page, "admin");
// 						}
// 					});
//
// 					test("jiraAppUninstall", async () => {
// 						expect(await jiraAppUninstall(page)).toBeTruthy();
// 					});
//
// 					test("jiraAppInstall", async () => {
// 						expect(await jiraAppInstall(page)).toBeTruthy();
// 					});
// 				});
// 			});
// 		});
//
// 		test.describe.skip("github", () => {
// 			test.describe(useState ? "with state" : "without state", () => {
// 				if (useState) {
// 					test.use({
// 						storageState: testData.jira.roles.admin.state
// 					});
// 				}
//
// 				test("githubLogin", async ({ page }) => {
// 					expect(await githubLogin(page, "admin")).toBeTruthy();
// 				});
//
// 				/*
// 				test("githubAppInstall", async ({ page }) => {
// 					expect(await githubAppInstall(page)).toBeTruthy();
// 				});
//
// 				test("githubAppUninstall", async ({ page }) => {
// 					expect(await githubAppUninstall(page)).toBeTruthy();
// 				});*/
// 			});
// 		});
// 	}
// });
//
