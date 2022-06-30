import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";

describe("GitHubServerApp", () => {

	it("should create a new entry in the GitHubServerApps table", async () => {

		const uuid = newUUID();
		const payload = {
			uuid: uuid,
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

		expect(savedGitHubServerApp).toEqual(expect.objectContaining({
			uuid: uuid,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 10
		}));
	});
});
