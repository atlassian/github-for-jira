import { GitHubServerApp } from "models/github-server-app";

describe("DELETE /jira/connect/enterprise", () => {
	const installationId = 72;

	beforeEach(async () => {
		await GitHubServerApp.create({
			uuid: "c97806fc-c433-4ad5-b569-bf5191590be2",
			appId: 1,
			gitHubAppName: "my awesome app1",
			gitHubBaseUrl: "http://myinternalinstance.com",
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret1",
			webhookSecret: "anothersecret1",
			privateKey: "privatekey1",
			installationId
		});
		await GitHubServerApp.create({
			uuid: "9eaf28d5-fe18-42d8-a76d-eba80adc2295",
			appId: 2,
			gitHubAppName: "my awesome app 2",
			gitHubBaseUrl: "http://myinternalinstance.com",
			gitHubClientId: "lvl.1n23j12389wnde",
			gitHubClientSecret: "secret2",
			webhookSecret: "anothersecret2",
			privateKey: "privatekey2",
			installationId
		});
		await GitHubServerApp.create({
			uuid: "7eaf28d5-fe12-42d8-a76d-eba80adc227a",
			appId: 3,
			gitHubAppName: "my awesome app 3",
			gitHubBaseUrl: "http://myinternalinstance-part2.com",
			gitHubClientId: "lvl.1n23j12389wndf",
			gitHubClientSecret: "secret3",
			webhookSecret: "anothersecret3",
			privateKey: "privatekey3",
			installationId
		});
	});

	it("should delete all gh apps for a server", async () => {
		const allServersForInstallationId = await GitHubServerApp.findForInstallationId(installationId);
		expect(allServersForInstallationId && allServersForInstallationId.length).toBe(3);

		await GitHubServerApp.uninstallServer("http://myinternalinstance.com");

		const deletedServerApps = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId("http://myinternalinstance.com", installationId);
		const storedServer = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId("http://myinternalinstance-part2.com", installationId);

		expect(deletedServerApps && deletedServerApps.length).toBe(0);
		expect(storedServer && storedServer.length).toBe(1);
	});
});
