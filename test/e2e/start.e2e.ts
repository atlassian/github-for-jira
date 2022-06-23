import { expect, test } from "@playwright/test";
/*
test.beforeEach(async ({ page }) => {
	// Runs before each test and signs in each page.
	await page.goto("https://github.com/login");
	await page.click("text=Login");
	await page.fill('input[name="login"]', "username");
	await page.fill('input[name="password"]', "password");
	await page.click("text=Submit");
});*/

// eslint-disable-next-line jest/no-done-callback
test("basic test", async ({ page }) => {
	await page.goto("https://joshkaye2e.atlassian.net/plugins/servlet/upm");

	// left han nav - github
	await page.click("[aria-label=\"GitHub\"] > .css-6oixoe");

	const frame = await page.frameLocator("iframe");
	await frame.locator(".jiraConfiguration__header__title").waitFor();
	expect(await frame.locator("text=Connect GitHub organization").isVisible()).toBeTruthy();
});
