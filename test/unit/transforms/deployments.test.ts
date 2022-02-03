/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line import/no-duplicates
import transformDeployment, { mapEnvironmentWithDefaultMapping } from "../../../src/transforms/deployment";
import { getLogger } from "../../../src/config/logger";
import { GitHubAPI } from "probot";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../../../src/config/feature-flags";

jest.mock("../../../src/config/feature-flags");

describe("deployment environment mapping", () => {
	test("classifies known environments correctly", () => {
		// Development
		expect(mapEnvironmentWithDefaultMapping("development")).toBe("development");
		expect(mapEnvironmentWithDefaultMapping("dev")).toBe("development");
		expect(mapEnvironmentWithDefaultMapping("trunk")).toBe("development");

		// Testing
		expect(mapEnvironmentWithDefaultMapping("testing")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("test")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("tests")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("tst")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("integration")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("integ")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("intg")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("int")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("acceptance")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("accept")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("acpt")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("qa")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("qc")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("control")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("quality")).toBe("testing");

		// Staging
		expect(mapEnvironmentWithDefaultMapping("staging")).toBe("staging");
		expect(mapEnvironmentWithDefaultMapping("stage")).toBe("staging");
		expect(mapEnvironmentWithDefaultMapping("stg")).toBe("staging");
		expect(mapEnvironmentWithDefaultMapping("preprod")).toBe("staging");
		expect(mapEnvironmentWithDefaultMapping("model")).toBe("staging");
		expect(mapEnvironmentWithDefaultMapping("internal")).toBe("staging");

		// Production
		expect(mapEnvironmentWithDefaultMapping("production")).toBe("production");
		expect(mapEnvironmentWithDefaultMapping("prod")).toBe("production");
		expect(mapEnvironmentWithDefaultMapping("prd")).toBe("production");
		expect(mapEnvironmentWithDefaultMapping("live")).toBe("production");
	});

	test("classifies known environments with prefixes and/or postfixes correctly", () => {
		expect(mapEnvironmentWithDefaultMapping("prod-east")).toBe("production");
		expect(mapEnvironmentWithDefaultMapping("prod_east")).toBe("production");
		expect(mapEnvironmentWithDefaultMapping("east-staging")).toBe("staging");
		expect(mapEnvironmentWithDefaultMapping("qa:1")).toBe("testing");
		expect(mapEnvironmentWithDefaultMapping("mary-dev:1")).toBe("development");
		expect(mapEnvironmentWithDefaultMapping("スパイク・スピーゲル-dev:1")).toBe("development");
		expect(mapEnvironmentWithDefaultMapping("trunk alpha")).toBe("development");
		expect(mapEnvironmentWithDefaultMapping("production(us-east)")).toBe("production");
		expect(mapEnvironmentWithDefaultMapping("prd (eu-central)")).toBe("production");
	});

	test("ignores case", () => {
		expect(mapEnvironmentWithDefaultMapping("Staging")).toBe("staging");
		expect(mapEnvironmentWithDefaultMapping("PROD-east")).toBe("production");
	});

	test("ignores diacritics", () => {
		expect(mapEnvironmentWithDefaultMapping("stàging")).toBe("staging");
	});

	test("classifies unknown environment names as 'unmapped'", () => {
		expect(mapEnvironmentWithDefaultMapping("banana-east")).toBe("unmapped");
		expect(mapEnvironmentWithDefaultMapping("internet")).toBe("unmapped");
		expect(mapEnvironmentWithDefaultMapping("製造")).toBe("unmapped");
	});
});

describe("transform GitHub webhook payload to Jira payload", () => {

	const deployment_status = require("../../fixtures/deployment_status-basic.json");
	const owner = deployment_status.payload.repository.owner.login;
	const repo = deployment_status.payload.repository.name;

	it("supports branch and merge workflows - CONFIG_AS_CODE disabled and SUPPORT_BRANCH_AND_MERGE_WORKFLOWS_FOR_DEPLOYMENTS enabled", async () => {
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
			.reply(200, {
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
				]
			}
			);


		when(booleanFlag).calledWith(
			BooleanFlags.SUPPORT_BRANCH_AND_MERGE_WORKFLOWS_FOR_DEPLOYMENTS,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);

		when(booleanFlag).calledWith(
			BooleanFlags.CONFIG_AS_CODE,
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

	it("supports branch and merge workflows - CONFIG_AS_CODE disabled", async () => {
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
			.reply(200, {
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
				]
			}
			);


		when(booleanFlag).calledWith(
			BooleanFlags.SUPPORT_BRANCH_AND_MERGE_WORKFLOWS_FOR_DEPLOYMENTS,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);

		when(booleanFlag).calledWith(
			BooleanFlags.CONFIG_AS_CODE,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(false);

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
});
