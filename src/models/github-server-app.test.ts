import { GitHubServerApp } from "models/git-hub-server-app";

describe("GitHubServerApp", () => {

	it("should create a new entry in the GitHubServerApp table", async () => {
		const uuid = "97da6b0e-ec61-11ec-8ea0-0242ac120002";

		const payload = {
			uuid,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 10
		};

		await GitHubServerApp.install(payload);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);

		expect(savedGitHubServerApp?.gitHubAppName).toEqual("My GitHub Server App");
	});
});
