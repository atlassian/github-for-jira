// global-setup.ts
import { chromium } from "@playwright/test";
import { jiraAppUninstall, jiraLogin } from "test/e2e/utils/jira";
import { testData } from "test/e2e/constants";
import { githubAppUninstall, githubLogin } from "test/e2e/utils/github";

export default async function teardown(/*config: FullConfig*/) {
	const browser = await chromium.launch();
	await Promise.all([
		// login to jira and save signed-in state
		jiraAppUninstall(
			browser,
			{
				...testData.jira.urls,
				...testData.jira.roles.admin
			}
		),
		// login to github and save signed-in state
		githubAppUninstall(
			browser,
			{
				...testData.github.urls,
				...testData.github.roles.admin
			}
		)
	]);
	await browser.close();
}
