/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/no-duplicates
import { transformDeployment, mapEnvironment } from "./transform-deployment";
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getInstallationId } from "../github/client/installation-id";
import deployment_status from "fixtures/deployment_status-basic.json";

jest.mock("config/feature-flags");

describe("deployment environment mapping", () => {
	it("classifies known environments correctly", () => {
		// Development
		expect(mapEnvironment("development")).toBe("development");
		expect(mapEnvironment("dev")).toBe("development");
		expect(mapEnvironment("trunk")).toBe("development");

		// Testing
		expect(mapEnvironment("testing")).toBe("testing");
		expect(mapEnvironment("test")).toBe("testing");
		expect(mapEnvironment("tests")).toBe("testing");
		expect(mapEnvironment("tst")).toBe("testing");
		expect(mapEnvironment("integration")).toBe("testing");
		expect(mapEnvironment("integ")).toBe("testing");
		expect(mapEnvironment("intg")).toBe("testing");
		expect(mapEnvironment("int")).toBe("testing");
		expect(mapEnvironment("acceptance")).toBe("testing");
		expect(mapEnvironment("accept")).toBe("testing");
		expect(mapEnvironment("acpt")).toBe("testing");
		expect(mapEnvironment("qa")).toBe("testing");
		expect(mapEnvironment("qc")).toBe("testing");
		expect(mapEnvironment("control")).toBe("testing");
		expect(mapEnvironment("quality")).toBe("testing");

		// Staging
		expect(mapEnvironment("staging")).toBe("staging");
		expect(mapEnvironment("stage")).toBe("staging");
		expect(mapEnvironment("stg")).toBe("staging");
		expect(mapEnvironment("preprod")).toBe("staging");
		expect(mapEnvironment("model")).toBe("staging");
		expect(mapEnvironment("internal")).toBe("staging");

		// Production
		expect(mapEnvironment("production")).toBe("production");
		expect(mapEnvironment("prod")).toBe("production");
		expect(mapEnvironment("prd")).toBe("production");
		expect(mapEnvironment("live")).toBe("production");
	});

	it("classifies known environments with prefixes and/or postfixes correctly", () => {
		expect(mapEnvironment("prod-east")).toBe("production");
		expect(mapEnvironment("prod_east")).toBe("production");
		expect(mapEnvironment("east-staging")).toBe("staging");
		expect(mapEnvironment("qa:1")).toBe("testing");
		expect(mapEnvironment("mary-dev:1")).toBe("development");
		expect(mapEnvironment("スパイク・スピーゲル-dev:1")).toBe("development");
		expect(mapEnvironment("trunk alpha")).toBe("development");
		expect(mapEnvironment("production(us-east)")).toBe("production");
		expect(mapEnvironment("prd (eu-central)")).toBe("production");
	});

	it("ignores case", () => {
		expect(mapEnvironment("Staging")).toBe("staging");
		expect(mapEnvironment("PROD-east")).toBe("production");
	});

	it("ignores diacritics", () => {
		expect(mapEnvironment("stàging")).toBe("staging");
	});

	it("classifies unknown environment names as 'unmapped'", () => {
		expect(mapEnvironment("banana-east")).toBe("unmapped");
		expect(mapEnvironment("internet")).toBe("unmapped");
		expect(mapEnvironment("製造")).toBe("unmapped");
	});
});

const TEST_INSTALLATION_ID = 1234;
describe("transform GitHub webhook payload to Jira payload", () => {

	const { payload: { repository: { name: repoName, owner } } } = deployment_status;
	const githubClient = new GitHubInstallationClient(getInstallationId(TEST_INSTALLATION_ID), getLogger("test"));

	it(`supports branch and merge workflows, sending related commits in deployment`, async () => {

		//If we use old GH Client we won't call the API because we pass already "authenticated" client to the test method
		githubUserTokenNock(TEST_INSTALLATION_ID);
		githubUserTokenNock(TEST_INSTALLATION_ID);
		githubUserTokenNock(TEST_INSTALLATION_ID);
		githubUserTokenNock(TEST_INSTALLATION_ID);

		// Mocking all GitHub API Calls
		// Get commit
		githubNock.get(`/repos/${owner.login}/${repoName}/commits/${deployment_status.payload.deployment.sha}`)
			.reply(200, {
				...owner,
				commit: {
					message: "testing"
				}
			});

		// List deployments
		githubNock.get(`/repos/${owner.login}/${repoName}/deployments?environment=Production&per_page=10`)
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
		githubNock.get(`/repos/${owner.login}/${repoName}/deployments/1/statuses?per_page=100`)
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
		githubNock.get(`/repos/${owner.login}/${repoName}/compare/6e87a40179eb7ecf5094b9c8d690db727472d5bc...${deployment_status.payload.deployment.sha}`)
			.reply(200, {
				commits: [
					{
						commit: {
							message: "ABC-1"
						},
						sha: "6e87a40179eb7ecf5094b9c8d690db727472d5bc1"
					},
					{
						commit: {
							message: "ABC-2"
						},
						sha: "6e87a40179eb7ecf5094b9c8d690db727472d5bc2"
					}
				]
			}
			);

		const jiraPayload = await transformDeployment(githubClient, deployment_status.payload as any, getLogger("deploymentLogger"));

		expect(jiraPayload).toMatchObject({
			deployments: [{
				schemaVersion: "1.0",
				deploymentSequenceNumber: 1234,
				updateSequenceNumber: 123456,
				displayName: "deploy",
				url: "test-repo-url/commit/885bee1-commit-id-1c458/checks",
				description: "deploy",
				lastUpdated: new Date("2021-06-28T12:15:18.000Z"),
				state: "successful",
				pipeline: {
					id: "deploy",
					displayName: "deploy",
					url: "test-repo-url/commit/885bee1-commit-id-1c458/checks"
				},
				environment: {
					id: "Production",
					displayName: "Production",
					type: "production"
				},
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["ABC-1", "ABC-2"]
					},
					{
						associationType: "commit",
						values: [
							{
								commitHash: "6e87a40179eb7ecf5094b9c8d690db727472d5bc1",
								repositoryId: "test-repo-id"
							},
							{
								commitHash: "6e87a40179eb7ecf5094b9c8d690db727472d5bc2",
								repositoryId: "test-repo-id"
							}
						]
					}
				]
			}]
		});
	});

	it(`supports branch and merge workflows, sending zero commits in deployment when 500 issues`, async () => {

		//If we use old GH Client we won't call the API because we pass already "authenticated" client to the test method
		githubUserTokenNock(TEST_INSTALLATION_ID);
		githubUserTokenNock(TEST_INSTALLATION_ID);
		githubUserTokenNock(TEST_INSTALLATION_ID);
		githubUserTokenNock(TEST_INSTALLATION_ID);

		// Mocking all GitHub API Calls
		// Get commit
		githubNock.get(`/repos/${owner.login}/${repoName}/commits/${deployment_status.payload.deployment.sha}`)
			.reply(200, {
				...owner,
				commit: {
					message: "testing"
				}
			});

		// List deployments
		githubNock.get(`/repos/${owner.login}/${repoName}/deployments?environment=Production&per_page=10`)
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
		githubNock.get(`/repos/${owner.login}/${repoName}/deployments/1/statuses?per_page=100`)
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

		// make message with 500 issue ids to prove there isn't room in the submission for any associated commits
		const commitMessage = "ABC-" + [...Array(500).keys()].join(" ABC-");

		// Compare commits
		githubNock.get(`/repos/${owner.login}/${repoName}/compare/6e87a40179eb7ecf5094b9c8d690db727472d5bc...${deployment_status.payload.deployment.sha}`)
			.reply(200, {
				commits: [
					{
						commit: {
							message: commitMessage
						},
						sha: "6e87a40179eb7ecf5094b9c8d690db727472d5bc1"
					}
				]
			}
			);

		const jiraPayload = await transformDeployment(githubClient, deployment_status.payload as any, getLogger("deploymentLogger"));

		// make expected issue id array
		const expectedIssueIds = [...Array(500).keys()].map(number => "ABC-" + number);

		expect(jiraPayload).toMatchObject({
			deployments: [{
				schemaVersion: "1.0",
				deploymentSequenceNumber: 1234,
				updateSequenceNumber: 123456,
				displayName: "deploy",
				url: "test-repo-url/commit/885bee1-commit-id-1c458/checks",
				description: "deploy",
				lastUpdated: new Date("2021-06-28T12:15:18.000Z"),
				state: "successful",
				pipeline: {
					id: "deploy",
					displayName: "deploy",
					url: "test-repo-url/commit/885bee1-commit-id-1c458/checks"
				},
				environment: {
					id: "Production",
					displayName: "Production",
					type: "production"
				},
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: expectedIssueIds
					}
				]
			}]
		});
	});
});
