/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line import/no-duplicates
import transformDeployment, { mapEnvironment } from "../../../src/transforms/deployment";
import {getLogger} from "../../../src/config/logger";
import {GitHubAPI} from "probot";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../../../src/config/feature-flags";

jest.mock("../../../src/config/feature-flags");

describe("deployment environment mapping - with Jira deployment config", () => {
	when(booleanFlag).calledWith(
		BooleanFlags.CONFIG_AS_CODE,
		expect.anything(),
		expect.anything()
	).mockResolvedValue(true);

	const deploymentConfig = {
		"deployments": {
			"environmentMapping": {
				"development": ["development", "dev"],
				"testing": ["test", "tests"],
				"staging": ["stage", "pre-prod", "STG", "staging"],
				"production": ["prod", "live", "production", "prod_east"]
			}
		}
	}

	// eslint-disable-next-line jest/no-focused-tests
	test("classifies known environments correctly", () => {
		// Development
		expect(mapEnvironment("development", deploymentConfig)).toBe("development");
		expect(mapEnvironment("dev", deploymentConfig)).toBe("development");

		// Testing
		expect(mapEnvironment("test", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("tests", deploymentConfig)).toBe("testing");

		// Staging
		expect(mapEnvironment("stage", deploymentConfig)).toBe("staging");
		expect(mapEnvironment("pre-prod", deploymentConfig)).toBe("staging");
		expect(mapEnvironment("STG", deploymentConfig)).toBe("staging");

		// Production
		expect(mapEnvironment("production", deploymentConfig)).toBe("production");
		expect(mapEnvironment("prod", deploymentConfig)).toBe("production");
		expect(mapEnvironment("prod_east", deploymentConfig)).toBe("production");
		expect(mapEnvironment("live", deploymentConfig)).toBe("production");
	});

	test("classifies known environments with prefixes and/or postfixes correctly", () => {
		expect(mapEnvironment("prod-east", deploymentConfig)).toBe("production");
		expect(mapEnvironment("prod_east", deploymentConfig)).toBe("production");
		expect(mapEnvironment("mary-dev:1", deploymentConfig)).toBe("development");
		expect(mapEnvironment("スパイク・スピーゲル-dev:1", deploymentConfig)).toBe("development");
		expect(mapEnvironment("production(us-east)", deploymentConfig)).toBe("production");
	});

	test("ignores case", () => {
		expect(mapEnvironment("Staging", deploymentConfig)).toBe("staging");
		expect(mapEnvironment("PROD-east", deploymentConfig)).toBe("production");
	});

	test("ignores diacritics", () => {
		expect(mapEnvironment("stàging", deploymentConfig)).toBe("staging");
	});

	test("classifies unknown environment names as 'unmapped'", () => {
		expect(mapEnvironment("banana-east", deploymentConfig)).toBe("unmapped");
		expect(mapEnvironment("internet", deploymentConfig)).toBe("unmapped");
		expect(mapEnvironment("製造", deploymentConfig)).toBe("unmapped");
	});
});

describe("deployment environment mapping - without Jira deployment config", () => {
	const deploymentConfig = null;

	test("classifies known environments correctly", () => {
		// Development
		expect(mapEnvironment("development", deploymentConfig)).toBe("development");
		expect(mapEnvironment("dev", deploymentConfig)).toBe("development");
		expect(mapEnvironment("trunk", deploymentConfig)).toBe("development");

		// Testing
		expect(mapEnvironment("testing", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("test", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("tests", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("tst", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("integration", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("integ", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("intg", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("int", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("acceptance", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("accept", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("acpt", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("qa", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("qc", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("control", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("quality", deploymentConfig)).toBe("testing");

		// Staging
		expect(mapEnvironment("staging", deploymentConfig)).toBe("staging");
		expect(mapEnvironment("stage", deploymentConfig)).toBe("staging");
		expect(mapEnvironment("stg", deploymentConfig)).toBe("staging");
		expect(mapEnvironment("preprod", deploymentConfig)).toBe("staging");
		expect(mapEnvironment("model", deploymentConfig)).toBe("staging");
		expect(mapEnvironment("internal", deploymentConfig)).toBe("staging");

		// Production
		expect(mapEnvironment("production", deploymentConfig)).toBe("production");
		expect(mapEnvironment("prod", deploymentConfig)).toBe("production");
		expect(mapEnvironment("prd", deploymentConfig)).toBe("production");
		expect(mapEnvironment("live", deploymentConfig)).toBe("production");
	});

	test("classifies known environments with prefixes and/or postfixes correctly", () => {
		expect(mapEnvironment("prod-east", deploymentConfig)).toBe("production");
		expect(mapEnvironment("prod_east", deploymentConfig)).toBe("production");
		expect(mapEnvironment("east-staging", deploymentConfig)).toBe("staging");
		expect(mapEnvironment("qa:1", deploymentConfig)).toBe("testing");
		expect(mapEnvironment("mary-dev:1", deploymentConfig)).toBe("development");
		expect(mapEnvironment("スパイク・スピーゲル-dev:1", deploymentConfig)).toBe("development");
		expect(mapEnvironment("trunk alpha", deploymentConfig)).toBe("development");
		expect(mapEnvironment("production(us-east)", deploymentConfig)).toBe("production");
		expect(mapEnvironment("prd (eu-central)", deploymentConfig)).toBe("production");
	});

	test("ignores case", () => {
		expect(mapEnvironment("Staging", deploymentConfig)).toBe("staging");
		expect(mapEnvironment("PROD-east", deploymentConfig)).toBe("production");
	});

	test("ignores diacritics", () => {
		expect(mapEnvironment("stàging", deploymentConfig)).toBe("staging");
	});

	test("classifies unknown environment names as 'unmapped'", () => {
		expect(mapEnvironment("banana-east", deploymentConfig)).toBe("unmapped");
		expect(mapEnvironment("internet", deploymentConfig)).toBe("unmapped");
		expect(mapEnvironment("製造", deploymentConfig)).toBe("unmapped");
	});
});

describe("transform GitHub webhook payload to Jira payload", () => {

	const deployment_status = require("../../fixtures/deployment_status-basic.json");
	const owner = deployment_status.payload.repository.owner.login;
	const repo = deployment_status.payload.repository.name;

	it("supports branch and merge workflows - FF TRUE", async () => {
		// Mocking all GitHub API Calls
		// Get commit
		githubNock.get(`/repos/${owner}/${repo}/commits/${deployment_status.payload.deployment.sha}`)
			.reply(200, {
				...owner,
				commit: {
					message: "testing"
				}
			});

		// List deployments
		githubNock.get(`/repos/${owner}/${repo}/deployments?environment=Production&per_page=10`)
			.reply(200,
				[
					{
						id: 1,
						environment: "Production",
						sha: "6e87a40179eb7ecf5094b9c8d690db727472d5bc"
					}
				]
			);

		// List deployments statuses
		githubNock.get(`/repos/${owner}/${repo}/deployments/1/statuses?per_page=100`)
			.reply(200, [
				{
					id: 1,
					state: "pending"
				},
				{
					id: 2,
					state: "success"
				}
			]);

		// Compare commits
		githubNock.get(`/repos/${owner}/${repo}/compare/6e87a40179eb7ecf5094b9c8d690db727472d5bc...${deployment_status.payload.deployment.sha}`)
			.reply(200,{
				commits: [
					{
						commit: {
							message: "ABC-1"
						}
					},
					{
						commit: {
							message: "ABC-2"
						}
					}
				]}
			);


		when(booleanFlag).calledWith(
			BooleanFlags.SUPPORT_BRANCH_AND_MERGE_WORKFLOWS_FOR_DEPLOYMENTS,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);

		const jiraPayload = await transformDeployment(GitHubAPI(), deployment_status.payload, 1234, "testing.atlassian.net", getLogger("deploymentLogger"))

		expect(jiraPayload).toMatchObject({
			deployments: [{
				schemaVersion: "1.0",
				deploymentSequenceNumber: 1234,
				updateSequenceNumber: 123456,
				issueKeys: ["ABC-1", "ABC-2"],
				displayName: "deploy",
				url: "test-repo-url/commit/885bee1-commit-id-1c458/checks",
				description: "deploy",
				lastUpdated: new Date("2021-06-28T12:15:18.000Z"),
				state: "successful",
				pipeline: {
					id: "deploy",
					displayName: "deploy",
					url: "test-repo-url/commit/885bee1-commit-id-1c458/checks",
				},
				environment: {
					id: "Production",
					displayName: "Production",
					type: "production",
				},
			}]
		})
	})

	// TODO add test if FF is false
});
