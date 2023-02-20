/* eslint-disable @typescript-eslint/no-explicit-any */
import { GitHubServerApp } from "models/github-server-app";
import { JiraConnectEnterprisePost } from "routes/jira/connect/enterprise/jira-connect-enterprise-post";
import { Installation } from "models/installation";
import { v4 as newUUID } from "uuid";

jest.mock("config/feature-flags");

const testSharedSecret = "test-secret";

describe("POST /jira/connect/enterprise", () => {
	let installation;
	const mockRequest = (gheServerURL: string): any => ({
		log: {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		},
		body: { gheServerURL },
		query: {},
		csrfToken: jest.fn().mockReturnValue({})
	});

	const mockResponse = (): any => {
		const response = {
			locals: {
				installation,
				jiraHost
			},
			render: jest.fn().mockReturnValue({}),
			status: jest.fn(),
			send: jest.fn().mockReturnValue({})
		};
		response.status = response.status.mockReturnValue(response);

		return response;
	};

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: testSharedSecret,
			clientKey: "client-key"
		});
	});

	afterEach(() => {
		delete process.env.JIRA_CONNECT_ENTERPRISE_POST_TIMEOUT_MSEC;
	});

	it("POST Jira Connect Enterprise - invalid URL", async () => {
		const response = mockResponse();
		await JiraConnectEnterprisePost(mockRequest("Random string!!"), response);

		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.send).toHaveBeenCalledWith({ success: false, errors: [{ code: "GHE_ERROR_INVALID_URL", reason: undefined }] });
	});

	it("POST Jira Connect Enterprise - invalid URL (port)", async () => {
		const response = mockResponse();
		await JiraConnectEnterprisePost(mockRequest("http://foobar.com:12345"), response);

		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.send).toHaveBeenCalledWith({
			success: false,
			errors: [{
				code: "GHE_ERROR_INVALID_URL",
				reason: "only the following ports are allowed: 80, 8080, 443, 6017, 8443, 8444, 7990, 8090, 8085, 8060, 8900, 9900"
			}]
		});
	});

	it("POST Jira Connect Enterprise - GitHub cloud", async () => {
		const response = mockResponse();
		await JiraConnectEnterprisePost(mockRequest("https://github.com:8090"), response);

		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.send).toHaveBeenCalledWith({
			success: false,
			errors: [{
				code: "GHE_ERROR_GITHUB_CLOUD_HOST"
			}]
		});
	});

	it("POST Jira Connect Enterprise - valid existing URL", async () => {
		await GitHubServerApp.install({
			uuid: newUUID(),
			appId: 1,
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "dragon",
			gitHubClientSecret: "dragon",
			webhookSecret: "dragon",
			privateKey: "dragon",
			gitHubAppName: "Monkey D. Dragon",
			installationId: installation.id
		}, jiraHost);

		const response = mockResponse();
		await JiraConnectEnterprisePost(mockRequest(gheUrl), response);

		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.send).toHaveBeenCalledWith({ success: true, appExists: true });
	});

	it("POST Jira Connect Enterprise - valid new URL", async () => {
		const response = mockResponse();
		gheNock.get("/").reply(200);
		await JiraConnectEnterprisePost(mockRequest(gheUrl), response);
		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.send).toHaveBeenCalledWith({ success: true, appExists: false });
	});

	it("POST Jira Connect Enterprise - URL timed out", async () => {
		process.env.JIRA_CONNECT_ENTERPRISE_POST_TIMEOUT_MSEC = "100";
		const response = mockResponse();
		gheNock.get("/").delayConnection(2000).reply(200);
		await JiraConnectEnterprisePost(mockRequest(gheUrl), response);
		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.send).toHaveBeenCalledWith({
			success: false, errors: [{
				code: "GHE_ERROR_CANNOT_CONNECT",
				reason: "ETIMEDOUT"
			}]
		});
	});

	it("POST Jira Connect Enterprise - invalid status code still return success", async () => {

		const response = mockResponse();
		gheNock.get("/").reply(500);
		await JiraConnectEnterprisePost(mockRequest(gheUrl), response);
		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.send).toHaveBeenCalledWith({ success: true, appExists: false });
	});

	it("POST Jira Connect Enterprise - network error code will fail", async () => {

		const response = mockResponse();
		await JiraConnectEnterprisePost(mockRequest(gheUrl), response);
		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.send).toHaveBeenCalledWith({
			success: false, errors: [{
				code: "GHE_ERROR_CANNOT_CONNECT",
				reason: expect.stringMatching(/ENOTFOUND|EAI_AGAIN/)
			}]
		});
	});
});
