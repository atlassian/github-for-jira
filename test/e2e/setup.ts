// global-setup.ts
import { chromium } from "@playwright/test";
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

	/*await Promise.all([
		// login to jira and save signed-in state
		jiraLogin(await browser.newPage(), "admin").then(jiraAppInstall),
		// login to github and save signed-in state
		githubLogin(await browser.newPage(), "admin")/!*.then(githubAppInstall)*!/
	]);*/

	await browser.close();
}
