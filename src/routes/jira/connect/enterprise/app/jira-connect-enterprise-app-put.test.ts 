import { GitHubServerApp } from "models/github-server-app";

describe("PUT /jira/connect/enterprise/app/:uuid", () => {
	const gitHubBaseUrl = "http://myinternalinstance.com";
	const installationId = 42;
	const uuid = "c97806fc-c433-4ad5-b569-bf5191590be2";
	const clientIdWithTypo = "lvl.1n23j12389wndd";
	const originalWebhookSecret = "anothersecret";
	const originalPrivateKey = "privatekey";
	let gitHubServerApp;

	beforeEach(async () => {
		gitHubServerApp = await GitHubServerApp.create({
			uuid,
			appId: 1,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl,
			gitHubClientId: clientIdWithTypo,
			gitHubClientSecret: "secret",
			webhookSecret: "anothersecret",
			privateKey: "privatekey",
			installationId
		});
	});

	it("should update GitHub app when uuid is found", async () => {
		const originalApp = await GitHubServerApp.findForUuid(uuid);
		expect(originalApp && originalApp.gitHubClientId).toEqual(clientIdWithTypo);
		expect(originalApp && originalApp.webhookSecret).toEqual(`encrypted:${originalWebhookSecret}`);
		expect(originalApp && originalApp.privateKey).toEqual(`encrypted:${originalPrivateKey}`);

		await GitHubServerApp.updateGitHubApp({
			uuid,
			appId: 1,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl,
			gitHubClientId: "lvl.1n23j12389wnde",
			gitHubClientSecret: "secret",
			webhookSecret: "anewsecret",
			privateKey: "privatekeyversion2",
			installationId
		});

		const updatedApp = await GitHubServerApp.findForUuid(uuid);
		expect(updatedApp && updatedApp.uuid).toEqual(gitHubServerApp.uuid);
		expect(updatedApp && updatedApp.gitHubClientId).toEqual("lvl.1n23j12389wnde");
		expect(updatedApp && updatedApp.webhookSecret).toEqual("anewsecret");
		expect(updatedApp && updatedApp.privateKey).toEqual("privatekeyversion2");
	});
});
