// global-setup.ts
import { chromium/*, FullConfig*/ } from "@playwright/test";

export default async function globalSetup(/*config: FullConfig*/) {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	const jiraUrl = "https://rachellerathbonee2e.atlassian.net";
	await page.goto(jiraUrl);
	const userinput = await page.locator("#username");
	const passinput = await page.locator("#password");
	await userinput.fill("rachellerathbone@gmail.com");
	await userinput.press("Enter");
	await passinput.fill("password!");
	await passinput.press("Enter");
	await page.waitForNavigation({ url: jiraUrl });
	// Save signed-in state
	await page.context().storageState({ path: "./test/e2e/.state.json" });
	await browser.close();
}
