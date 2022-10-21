import { Page } from "@playwright/test";
import { testData } from "test/e2e/constants";

export const ngrokBypass = async (page: Page): Promise<Page> => {
	await page.goto(testData.appUrl);
	const button = await page.waitForSelector("#ngrok button", { timeout: 5000 }).catch(() => undefined);
	if (button) {
		await page.click("#ngrok button");
		await page.waitForLoadState();
		await page.context().storageState({ path: testData.state });
	}

	return page;
};
