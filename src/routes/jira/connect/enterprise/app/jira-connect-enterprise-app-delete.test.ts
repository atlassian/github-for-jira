/* eslint-disable @typescript-eslint/no-explicit-any */
import Mock = jest.Mock;
import { GitHubServerApp } from "models/github-server-app";
import { JiraConnectEnterpriseAppDelete } from "routes/jira/connect/enterprise/app/jira-connect-enterprise-app-delete";

describe("DELETE /jira/connect/enterprise/app/:uuid", () => {
	const gitHubBaseUrl = "http://myinternalinstance.com";
	const installationId = 72;
	const appOneUuid = "c97806fc-c433-4ad5-b569-bf5191590be2";
	const appTwoUuid = "9eaf28d5-fe18-42d8-a76d-eba80adc2295";
	let next: Mock;

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

	const mockResponse = (): any => {
		const response = {
			locals: {},
			render: jest.fn().mockReturnValue({}),
			status: jest.fn(),
			send: jest.fn().mockReturnValue({})
		};
		response.status = response.status.mockReturnValue(response);

		return response;
	};

	beforeEach(async () => {
		await GitHubServerApp.create({
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
			uuid: "9eaf28d5-fe18-42d8-a76d-eba80adc2295",
			appId: 2,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl,
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret",
			webhookSecret: "anothersecret",
			privateKey: "privatekey",
			installationId
		});

		next = jest.fn();
	});

	it("should delete GitHub app when uuid is found", async () => {
		const records = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId(gitHubBaseUrl, installationId);
		expect(records.length).toBe(2);

		await GitHubServerApp.uninstall(appOneUuid);

		const appOne = await GitHubServerApp.findForUuid(appOneUuid);
		expect(appOne).toBeNull();
		const appTwo = await GitHubServerApp.findForUuid(appTwoUuid);
		expect(appTwo).not.toBeNull();
	});

	it("should send a successful response when app is deleted", async () => {
		const response = mockResponse();
		await JiraConnectEnterpriseAppDelete(mockRequest("95980446-16e1-11ed-861d-0242ac120002"), response, next);

		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.send).toHaveBeenCalledWith({ success: true });
	});

	it("should send a failure response when unable to delete app", async () => {
		const response = mockResponse();
		await JiraConnectEnterpriseAppDelete(mockRequest("this is not a uuid"), response, next);

		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.send).toHaveBeenCalledWith({ success: false, message: "Failed to delete GitHub App." });
	});
});
