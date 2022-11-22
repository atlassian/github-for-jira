import { GitHubServerApp } from "models/github-server-app";
import { JiraConnectEnterpriseAppDelete } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-delete";

describe("DELETE /jira/connect/enterprise/app/:uuid", () => {
	const gitHubBaseUrl = "http://myinternalinstance.com";
	const installationId = 72;
	const appOneUuid = "c97806fc-c433-4ad5-b569-bf5191590be2";
	const appTwoUuid = "9eaf28d5-fe18-42d8-a76d-eba80adc2295";

	const mockRequest = (uuid: string): any => ({
		log: {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		},
		query: {},
		body: { uuid },
		csrfToken: jest.fn().mockReturnValue({})
	});

	const mockResponse = async (): Promise<any> => {
		const response = {
			locals: {
				gitHubAppConfig: {
					gitHubAppId: gheAppOne.id,
					appId: gheAppOne.appId,
					uuid: gheAppOne.uuid,
					hostname: gheAppOne.gitHubBaseUrl,
					clientId: gheAppOne.gitHubClientId,
					gitHubClientSecret: await gheAppOne.getDecryptedGitHubClientSecret(jiraHost),
					webhookSecret: await gheAppOne.getDecryptedWebhookSecret(jiraHost),
					privateKey: await gheAppOne.getDecryptedPrivateKey(jiraHost)
				}
			},
			render: jest.fn().mockReturnValue({}),
			status: jest.fn(),
			json: jest.fn().mockReturnValue({})
		};
		response.status = response.status.mockReturnValue(response);

		return response;
	};

	let gheAppOne: GitHubServerApp;

	beforeEach(async () => {
		gheAppOne = await GitHubServerApp.create({
			uuid: appOneUuid,
			appId: 1,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl,
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret",
			webhookSecret: "anothersecret",
			privateKey: "privatekey",
			installationId
		});
		await GitHubServerApp.create({
			uuid: appTwoUuid,
			appId: 2,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl,
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret",
			webhookSecret: "anothersecret",
			privateKey: "privatekey",
			installationId
		});
	});

	it("should delete GitHub app when uuid is found", async () => {
		const records = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId(gitHubBaseUrl, installationId);
		expect(records.length).toBe(2);

		await GitHubServerApp.uninstallApp(appOneUuid);

		const appOne = await GitHubServerApp.findForUuid(appOneUuid);
		expect(appOne).toBeNull();
		const appTwo = await GitHubServerApp.findForUuid(appTwoUuid);
		expect(appTwo).not.toBeNull();
	});

	it("should send a successful response when app is deleted", async () => {
		const response = await mockResponse();
		await JiraConnectEnterpriseAppDelete(mockRequest(appOneUuid), response);

		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.json).toHaveBeenCalledWith({ success: true });
	});

	it("should send a failure response when unable to delete app", async () => {
		const response = await mockResponse();
		delete response.locals.gitHubAppConfig;
		await JiraConnectEnterpriseAppDelete(mockRequest("this is not a uuid"), response);

		expect(response.status).toHaveBeenCalledWith(404);
		expect(response.json).toHaveBeenCalledWith({ message: "No GitHub App found. Cannot delete." });
	});
});
