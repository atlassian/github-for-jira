/* eslint-disable @typescript-eslint/no-var-requires */
import { mapEnvironment } from "../../../src/transforms/deployment";
import transformDeployment from "../../../src/transforms/deployment";
import {getLogger} from "../../../src/config/logger";
import {GitHubAPI} from "probot";

describe("deployment environment mapping", () => {
	test("classifies known environments correctly", () => {
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

	test("classifies known environments with prefixes and/or postfixes correctly", () => {
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

	test("ignores case", () => {
		expect(mapEnvironment("Staging")).toBe("staging");
		expect(mapEnvironment("PROD-east")).toBe("production");
	});

	test("ignores diacritics", () => {
		expect(mapEnvironment("stàging")).toBe("staging");
	});

	test("classifies unknown environment names as 'unmapped'", () => {
		expect(mapEnvironment("banana-east")).toBe("unmapped");
		expect(mapEnvironment("internet")).toBe("unmapped");
		expect(mapEnvironment("製造")).toBe("unmapped");
	});
});

describe("transform GitHub webhook payload to Jira payload", () => {

	const deployment_status = require("../../fixtures/deployment_status-basic.json");
	console.log(JSON.stringify(deployment_status));
	const owner = deployment_status.payload.deployment_status.creator.login;
	const repo = deployment_status.payload.repository.name;

	beforeEach(async () => {
		jest.setTimeout(30000);
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
		githubNock.get(`/repos/${owner}/${repo}/deployments`)
			.reply(200, {
				data: [
					{
						id: 1,
						environment: "test"
					},
					{
						id: 2,
						environment: "test"
					},
					{
						id: 3,
						environment: " new test env"
					}
				]
			});

		// List deployments statuses
		githubNock.get(`/repos/${owner}/${repo}/deployments/1/statuses`)
			.reply(200, {
				data: [
					{
						id: 1,
						state: "pending"
					},
					{
						id: 2,
						state: "success"
					}
				]
			});

		// Get a deployment status
		githubNock.get(`/repos/${owner}/${repo}/deployments/1/statuses/1`)
			.reply(200, {
				state: "success",
				sha: "6e87a40179eb7ecf5094b9c8d690db727472d5bc"
			});

		// Compare commits
		githubNock.get(`/repos/${owner}/${repo}/compare/{6e87a40179eb7ecf5094b9c8d690db727472d5bc...${deployment_status.payload.deployment.sha}`)
			.reply(200, {
				data: [{
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
				]
			});
	});

	it("supports branch and merge workflows", async () => {

		try {
			const jiraPayload = await transformDeployment(GitHubAPI(), deployment_status.payload, getLogger("deploymentLogger"))

			expect(jiraPayload).toMatchObject({
				deployments: [{
					schemaVersion: "1.0",
					deploymentSequenceNumber: 1234,
					updateSequenceNumber: 123456,
					issueKeys: ["ABC-1", "ABC-2"],
					displayName: "deploy",
					url: "test-repo-url/commit/885bee1-commit-id-1c458/checks",
					description: "deploy",
					lastUpdated: "2021-06-28T12:15:18Z",
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
		} catch (e) {
			console.log(e);
		}
	})
});
