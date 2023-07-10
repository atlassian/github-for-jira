import supertest from "supertest";
import { Express } from "express";
import { getFrontendApp } from "~/src/app";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { getLogger } from "config/logger";
import {
	defineJiraDevelopmentToolModuleActions,
	JiraAtlassianConnectGet
} from "routes/jira/atlassian-connect/jira-atlassian-connect-get";

jest.mock("config/feature-flags");

describe("Atlassian Connect", () => {
	let app: Express;

	beforeEach(() => {
		app = getFrontendApp();
	});

	it("should return correct connect app descriptor", () => {
		return supertest(app)
			.get("/jira/atlassian-connect.json")
			.expect(200)
			.then(response => {
				// removing keys that changes for every test run
				delete response.body.baseUrl;
				delete response.body.name;
				delete response.body.key;
				expect(response.body).toMatchSnapshot();
			});
	});

	describe("Generic Container util - defineJiraDevelopmentToolModuleActions", () => {
		let mockResponse;

		beforeEach(async () => {
			mockResponse = {
				status: jest.fn(() => ({
					json: jest.fn(() => Promise.resolve([]))
				}))
			};
		});

		it("should return generic container urls, and create branch url, when feature flag is enabled", async () => {
			const req = { log: getLogger("test") } as any;
			const res = { ...mockResponse, locals: { jiraHost } } as any;
			when(booleanFlag).calledWith(
				BooleanFlags.ENABLE_GENERIC_CONTAINERS, jiraHost
			).mockResolvedValue(true);


			await JiraAtlassianConnectGet(req, res);
			expect(res.status).toHaveBeenCalledWith(200);
			const actions =  await defineJiraDevelopmentToolModuleActions(jiraHost);
			expect(actions).toEqual({
				"associateRepository": {
					"templateUrl": "https://test-github-app-instance.com/jira/workspaces/repositories/associate"
				},
				"createBranch": {
					"templateUrl": "https://test-github-app-instance.com/create-branch-options?issueKey={issue.key}&issueSummary={issue.summary}&tenantUrl={tenant.url}&jwt={jwt}&addonkey=com.github.integration.test-atlassian-instance"
				},
				"searchConnectedWorkspaces":
				{
					"templateUrl": "https://test-github-app-instance.com/jira/workspaces/search"
				},
				"searchRepositories": {
					"templateUrl": "https://test-github-app-instance.com/jira/workspaces/repositories/search"
				}
			});
		});

		it("should only return the create branch url when generic container FF is not enabled", async () => {
			const req = { log: getLogger("test") } as any;
			const res = { ...mockResponse, locals: { jiraHost } } as any;
			when(booleanFlag).calledWith(
				BooleanFlags.ENABLE_GENERIC_CONTAINERS, jiraHost
			).mockResolvedValue(false);


			await JiraAtlassianConnectGet(req, res);
			expect(res.status).toHaveBeenCalledWith(200);
			const actions =  await defineJiraDevelopmentToolModuleActions(jiraHost);
			expect(actions).toEqual({
				"createBranch": {
					"templateUrl": "https://test-github-app-instance.com/create-branch-options?issueKey={issue.key}&issueSummary={issue.summary}&tenantUrl={tenant.url}&jwt={jwt}&addonkey=com.github.integration.test-atlassian-instance"
				}
			});
		});
	});
});
