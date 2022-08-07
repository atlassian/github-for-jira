/* eslint-disable @typescript-eslint/no-explicit-any */
import { GitHubServerApp } from "models/github-server-app";
// import { Installation } from "models/installation";
//
// const testSharedSecret = "test-secret";

describe("DELETE /jira/connect/enterprise/app/:uuid", () => {
	let gitHubApp;
	const uuid = "c97806fc-c433-4ad5-b569-bf5191590be2";
	const gitHubBaseUrl = "http://myinternalinstance.com";
	const installationId = 72;

	beforeEach(async () => {
		// installation = await Installation.install({
		// 	host: jiraHost,
		// 	sharedSecret: testSharedSecret,
		// 	clientKey: "client-key"
		// });
		gitHubApp = await GitHubServerApp.install({
			uuid,
			appId: 1,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl,
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret",
			webhookSecret: "anothersecret",
			privateKey: "privatekey",
			installationId
		});
	});

	it("should DELETE GitHub app when uuid is found", async () => {
		expect(await GitHubServerApp.getAllForGitHubBaseUrl(gitHubBaseUrl, installationId)).toEqual([gitHubApp]);


	});

	it("should throw an error when uuid is not found", async () => {

	});
});
