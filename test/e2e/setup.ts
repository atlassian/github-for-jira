// global-setup.ts
import { chromium } from "@playwright/test";
import { jiraAppInstall, jiraLogin } from "test/e2e/utils/jira";
import { testData } from "test/e2e/constants";
import { githubLogin } from "test/e2e/utils/github";

export default async function setup(/*config: FullConfig*/) {
	/*githubContext = await request.newContext({
		baseURL: "https://api.github.com",
		extraHTTPHeaders: {
			// We set this header per GitHub guidelines.
			"Accept": "application/vnd.github.v3+json",
			// Add authorization token to all requests.
			// Assuming personal access token available in the environment.
			"Authorization": `token ${process.env.API_TOKEN}`
		}
	});
	hostContext = await request.newContext({
		baseURL: hostUrl,
		extraHTTPHeaders: {}
	});*/
	const browser = await chromium.launch();

	await Promise.all([
		// login to jira and save signed-in state
		jiraLogin(
			browser,
			{
				...testData.jira.urls,
				...testData.jira.roles.admin
			}
		),
		// login to github and save signed-in state
		githubLogin(
			browser,
			{
				...testData.github.urls,
				...testData.github.roles.admin
			}c
		)
	]);

	await jiraAppInstall(browser);
	await browser.close();
}
