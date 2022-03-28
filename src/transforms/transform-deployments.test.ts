/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/no-duplicates
import { transformDeployment, mapEnvironment } from "./transform-deployment";
import { getLogger } from "config/logger";
import { GitHubAPI } from "probot";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { GitHubAppClient } from "../github/client/github-app-client";
import { getCloudInstallationId } from "../github/client/installation-id";

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
describe.each([true, false])("transform GitHub webhook payload to Jira payload", (useNewGithubClient) => {

	const { payload: { repository: { name: repoName, owner } } } = deployment_status;
	const githubClient = new GitHubAppClient(getCloudInstallationId(TEST_INSTALLATION_ID), getLogger("test"));

	beforeEach(() => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DEPLOYMENTS,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(useNewGithubClient);
	});

	it(`supports branch and merge workflows - FF '${useNewGithubClient}'`, async () => {

		//If we use old GH Client we won't call the API because we pass already "authenticated" client to the test method
		if (useNewGithubClient) {
			githubUserTokenNock(TEST_INSTALLATION_ID);
			githubUserTokenNock(TEST_INSTALLATION_ID);
			githubUserTokenNock(TEST_INSTALLATION_ID);
			githubUserTokenNock(TEST_INSTALLATION_ID);
		}

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

		const jiraPayload = await transformDeployment(GitHubAPI(), githubClient, deployment_status.payload as any, "testing.atlassian.net", getLogger("deploymentLogger"));

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
					url: "test-repo-url/commit/885bee1-commit-id-1c458/checks"
				},
				environment: {
					id: "Production",
					displayName: "Production",
					type: "production"
				}
			}]
		});
	});
});
