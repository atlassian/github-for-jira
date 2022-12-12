/* eslint-disable @typescript-eslint/no-explicit-any */
import { mocked } from "ts-jest/utils";
import { GitHubServerApp } from "models/github-server-app";
import { JiraConnectEnterpriseGet } from "routes/jira/connect/enterprise/jira-connect-enterprise-get";

const mockRequest = (): any => ({
	log: {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn()
	},
	query: {},
	csrfToken: jest.fn().mockReturnValue({})
});

const mockResponse = (): any => ({
	locals: {
		installation: { id: 1 },
		jiraHost
	},
	render: jest.fn().mockReturnValue({}),
	status: jest.fn().mockReturnValue({}),
	send: jest.fn().mockReturnValue({})
});

jest.mock("models/github-server-app");

describe("GET /jira/connect/enterprise - with existing GitHub Server apps", () => {
	let servers;

	beforeEach(async () => {
		servers = [
			{
				id: 1,
				uuid: "uuid-1",
				appId: 1,
				gitHubBaseUrl: "http://github.internal.atlassian.com",
				gitHubClientId: "dragon",
				gitHubClientSecret: "dragon",
				webhookSecret: "dragon",
				privateKey: "dragon",
				gitHubAppName: "Monkey D. Dragon",
				installationId: 1,
				updatedAt: Date.now(),
				createdAt: Date.now()
			},
			{
				id: 2,
				uuid: "uuid-2",
				appId: 2,
				gitHubBaseUrl: "http://github.internal2.atlassian.com",
				gitHubClientId: "sabo",
				gitHubClientSecret: "sabo",
				webhookSecret: "sabo",
				privateKey: "sabo",
				gitHubAppName: "Sabo",
				installationId: 1,
				updatedAt: Date.now(),
				createdAt: Date.now()
			}
		];

		mocked(GitHubServerApp.findForInstallationId).mockResolvedValue(servers);
	});

	it("GET Jira Connect Enterprise", async () => {
		const response = mockResponse();
		await JiraConnectEnterpriseGet(mockRequest(), response, jest.fn());

		expect(response.render.mock.calls[0][0]).toBe("jira-select-server.hbs");
		expect(response.render.mock.calls[0][1].list).toHaveLength(2);
	});
});

describe("GET /jira/connect/enterprise - with no GitHub Server apps", () => {
	let servers;

	beforeEach(async () => {
		servers = [];

		mocked(GitHubServerApp.findForInstallationId).mockResolvedValue(servers);
	});

	it("GET Jira Connect Enterprise", async () => {
		const response = mockResponse();
		await JiraConnectEnterpriseGet(mockRequest(), response, jest.fn());

		expect(response.render.mock.calls[0][0]).toBe("jira-server-url.hbs");
	});
});

describe("GET /jira/connect/enterprise?new", () => {
	it("Connect Jira GitHub Enterprise", async () => {
		const response = mockResponse();
		await JiraConnectEnterpriseGet(mockRequest(), response, jest.fn());

		expect(response.render.mock.calls[0][0]).toBe("jira-server-url.hbs");
	});
});
