import { expect, test } from "@playwright/test";

// eslint-disable-next-line jest/no-done-callback
test("test", async ({ page }) => {
	await page.goto("https://rachellerathbonee2e.atlassian.net/plugins/servlet/upm");

	// left han nav - github
	await page.click("[aria-label=\"GitHub\"] > .css-6oixoe");

	const frame = await page.frameLocator("iframe");
	await frame.locator(".jiraConfiguration__header__title").waitFor();
	expect(await frame.locator("text=Connect GitHub organization").isVisible()).toBeTruthy();
	await frame.locator("text=Connect GitHub organization").click();
});
