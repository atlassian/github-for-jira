import supertest from "supertest";
import { Express } from "express";
import { getFrontendApp } from "~/src/app";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

describe("Atlassian Connect", () => {
	let app: Express;

	beforeEach(() => {
		app = getFrontendApp();
	});

	describe("Frontend", () => {

		it("should return correct connect app descriptor", () => {

			return supertest(app)
				.get("/jira/atlassian-connect.json")
				.expect(200)
				.then(response => {
					// removing keys that changes for every test run
					delete response.body.baseUrl;
					delete response.body.name;
					delete response.body.key;
					const jiraDevelopmentToolActions = response.body.modules.jiraDevelopmentTool.actions;
					expect(response.body).toMatchSnapshot();
					expect(Object.keys(jiraDevelopmentToolActions)).toEqual(["createBranch"]);
					expect(Object.keys(jiraDevelopmentToolActions)).not.toEqual([
						"createBranch",
						"searchConnectedWorkspaces",
						"searchRepositories",
						"associateRepository"
					]);
				});
		});

		it("should return generic container actions when feature flag is enabled", async () => {
			when(booleanFlag).calledWith(
				BooleanFlags.ENABLE_GENERIC_CONTAINERS
			).mockResolvedValue(true);

			const response = await supertest(app)
				.get("/jira/atlassian-connect.json")
				.expect(200);

			const jiraDevelopmentToolActions = response.body.modules.jiraDevelopmentTool.actions;
			expect(response.body).toMatchSnapshot();
			expect(Object.keys(jiraDevelopmentToolActions)).toEqual([
				"createBranch",
				"searchConnectedWorkspaces",
				"searchRepositories",
				"associateRepository"
			]);
			expect(response).not.toEqual(["createBranch"]);
		});
	});

});
