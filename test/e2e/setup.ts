// global-setup.ts
import { chromium } from "@playwright/test";
import { jiraLogin } from "test/e2e/utils/jira";
import { githubLogin } from "test/e2e/utils/github";
import { clearState, stateExists } from "test/e2e/e2e-utils";
import { testData } from "test/e2e/constants";
// import { jiraAppInstall, jiraLogin } from "test/e2e/utils/jira";
// import { githubLogin } from "test/e2e/utils/github";

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

	clearState();
	// login and save state before tests
	await Promise.all([
		jiraLogin(await browser.newPage(), "admin", true),
		githubLogin(await browser.newPage(), "admin", true)
	]);
	/*let page = await browser.newPage();
	await jiraLogin(page, "admin", true);
	await page.close();

	page = await browser.newPage();
	await githubLogin(page, "admin", true);
	await page.close();*/
	await browser.close();
	if (!stateExists(testData.jira.roles.admin) || !stateExists(testData.github.roles.admin)) {
		throw "Missing state";
	}
}
