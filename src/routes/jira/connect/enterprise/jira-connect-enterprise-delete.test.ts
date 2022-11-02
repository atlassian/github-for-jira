import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { getLogger } from "config/logger";
import { JiraConnectEnterpriseDelete } from "./jira-connect-enterprise-delete";

describe("DELETE /jira/connect/enterprise", () => {

	const JIRA_HOST_1 = "https://111.atlassian.net";
	const JIRA_HOST_2 = "https://222.atlassian.net";
	const GITHUB_BASE_URL_1 = "http://myinternalinstance.com";
	const GITHUB_BASE_URL_2 = "http://myinternalinstance-part2.com";

	let installationId1: number;
	let installationId2: number;

	beforeEach(async () => {
		//Three GHE app for first installation for JIRA_HOST_1
		const installation1 = await Installation.install({
			clientKey: "clientKey1",
			host: JIRA_HOST_1,
			sharedSecret: "12345"
		});
		installationId1 = installation1.id;
		await GitHubServerApp.create({
			uuid: "c97806fc-c433-4ad5-b569-bf5191590be2",
			appId: 1,
			gitHubAppName: "my awesome app1",
			gitHubBaseUrl: GITHUB_BASE_URL_1,
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret1",
			webhookSecret: "anothersecret1",
			privateKey: "privatekey1",
			installationId: installationId1
		});
		await GitHubServerApp.create({
			uuid: "9eaf28d5-fe18-42d8-a76d-eba80adc2295",
			appId: 2,
			gitHubAppName: "my awesome app 2",
			gitHubBaseUrl: GITHUB_BASE_URL_1,
			gitHubClientId: "lvl.1n23j12389wnde",
			gitHubClientSecret: "secret2",
			webhookSecret: "anothersecret2",
			privateKey: "privatekey2",
			installationId: installationId1
		});
		await GitHubServerApp.create({
			uuid: "7eaf28d5-fe12-42d8-a76d-eba80adc227a",
			appId: 3,
			gitHubAppName: "my awesome app 3",
			gitHubBaseUrl: GITHUB_BASE_URL_2,
			gitHubClientId: "lvl.1n23j12389wndf",
			gitHubClientSecret: "secret3",
			webhookSecret: "anothersecret3",
			privateKey: "privatekey3",
			installationId: installationId1
		});
		//One GHE app for first installation for JIRA_HOST_1
		const installation2 = await Installation.install({
			clientKey: "clientKey2",
			host: JIRA_HOST_2,
			sharedSecret: "78990"
		});
		installationId2 = installation2.id;
		await GitHubServerApp.create({
			uuid: "22e568d5-fe12-42d8-a76d-eba4aabc223d",
			appId: 1,
			gitHubAppName: "my awesome app 1",
			gitHubBaseUrl: GITHUB_BASE_URL_2,
			gitHubClientId: "lvl.1n23j12389wndf",
			gitHubClientSecret: "secret3",
			webhookSecret: "anothersecret3",
			privateKey: "privatekey3",
			installationId: installationId2
		});
	});

	it("should delete all gh apps for a server", async () => {
		const allServersForInstallationId = await GitHubServerApp.findForInstallationId(installationId1);
		expect(allServersForInstallationId && allServersForInstallationId.length).toBe(3);

		await GitHubServerApp.uninstallServer(GITHUB_BASE_URL_1, installationId1);

		const deletedServerApps = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId(GITHUB_BASE_URL_1, installationId1);
		const storedServer = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId(GITHUB_BASE_URL_2, installationId1);

		expect(deletedServerApps && deletedServerApps.length).toBe(0);
		expect(storedServer && storedServer.length).toBe(1);
	});

	it("should NOT able to delete other jiraHost ghe app", async () => {

		const req = {
			log: getLogger("test"),
			body: {
				serverUrl: GITHUB_BASE_URL_2
			}
		};
		const send = jest.fn();
		const res = {
			locals: {
				jiraHost: JIRA_HOST_2
			},
			status: jest.fn(() => ({ send }))
		};
		const next = jest.fn();

		//delete some GHE apps
		await JiraConnectEnterpriseDelete(req as any, res as any, next);
		expect(res.status).toHaveBeenCalledWith(200);
		expect(send).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

		//assert on remaining apps
		const allServers = await GitHubServerApp.findAll();
		expect(allServers.length).toBe(3);
		const serverFromOtherJiraHost = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId(GITHUB_BASE_URL_2, installationId1);
		expect(serverFromOtherJiraHost.length).toBe(1);
	});
});
