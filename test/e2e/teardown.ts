// global-setup.ts
import { chromium } from "@playwright/test";
import { jiraAppUninstall } from "test/e2e/utils/jira";

export default async function teardown(/*config: FullConfig*/) {
	const browser = await chromium.launch();
	await Promise.all([
		// login to jira and save signed-in state
		jiraAppUninstall(await browser.newPage())
		// login to github and save signed-in state
		// githubAppUninstall(await browser.newPage())
	]);
	await browser.close();
}
