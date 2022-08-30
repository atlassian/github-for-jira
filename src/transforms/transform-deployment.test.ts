/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/no-duplicates
import { transformDeployment, mapEnvironment } from "./transform-deployment";
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getInstallationId, InstallationId } from "../github/client/installation-id";
import deployment_status from "fixtures/deployment_status-basic.json";
import deployment_status_staging from "fixtures/deployment_status_staging.json";
import { getRepoConfig } from "services/user-config-service";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { DatabaseStateCreator } from "test/utils/database-state-creator";

jest.mock("config/feature-flags");
jest.mock("services/user-config-service");

const turnFF_OnOff_service = (newStatus: boolean) => {
	when(jest.mocked(booleanFlag))
		.calledWith(BooleanFlags.SERVICE_ASSOCIATIONS_FOR_DEPLOYMENTS, expect.anything())
		.mockResolvedValue(newStatus);
};

const mockConfig = {
	deployments: {
		environmentMapping: {
			development: [
				"foo*" // nonsense pattern to make sure that we're hitting it in the tests below
			]
		},
		services: {
			ids: [
				"service-id-1",
				"service-id-2"
			]
		}
	}
};

const turnOnGHESFF = () => {
	when(jest.mocked(booleanFlag))
		.calledWith(BooleanFlags.GHE_SERVER, expect.anything(), expect.anything())
		.mockResolvedValue(true);
};

const buildJiraPayload = (associations) => {
	return {
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
			associations
		}]
	};
};

describe("deployment environment mapping", () => {

	it("falls back to hardcoded config when user config doesn't match", () => {
		const userConfig = {
			deployments: {
				environmentMapping: {
					development: [
						"foo*" // nonsense pattern to make sure that we're hitting it in the tests below
					]
				}
			}
		};

		// match
		expect(mapEnvironment("foo42", userConfig)).toBe("development");

		// no match - fallback to hardcoded values
		expect(mapEnvironment("dev", userConfig)).toBe("development");
		expect(mapEnvironment("test", userConfig)).toBe("testing");
		expect(mapEnvironment("stage", userConfig)).toBe("staging");
		expect(mapEnvironment("prd", userConfig)).toBe("production");

	});

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

describe("transform GitHub webhook payload to Jira payload", () => {
	const { payload: { repository: { name: repoName, owner } } } = deployment_status;
	let gitHubClient: GitHubInstallationClient;

	describe("cloud", () => {

		beforeEach(async () => {
			gitHubClient = new GitHubInstallationClient(getInstallationId(DatabaseStateCreator.GITHUB_INSTALLATION_ID), gitHubCloudConfig, getLogger("test"));

			await new DatabaseStateCreator().create();
		});

		it(`uses user config to associate services`, async () => {
			turnFF_OnOff_service(true);

			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

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
			githubNock.get(`/repos/${owner.login}/${repoName}/deployments?environment=foo42&per_page=10`)
				.reply(200,
					[
						{
							id: 1,
							environment: "foo42",
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

			when(getRepoConfig).calledWith(
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.anything()
			).mockResolvedValue(mockConfig);

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status_staging.payload as any, jiraHost, getLogger("deploymentLogger"), undefined);


			expect(jiraPayload?.deployments[0].associations).toStrictEqual(
				[
					{
						associationType: "issueIdOrKeys",
						values: ["ABC-123", "ABC-1", "ABC-2"]
					},
					{
						associationType: "serviceIdOrKeys",
						values: ["service-id-1", "service-id-2"]
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
					}]
			);
		});

		it(`supports branch and merge workflows, sending related commits in deploymentfor Cloud`, async () => {

			//If we use old GH Client we won't call the API because we pass already "authenticated" client to the test method
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

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
				});

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status.payload as any, jiraHost, getLogger("deploymentLogger"), undefined);

			expect(jiraPayload).toMatchObject(buildJiraPayload([
				{
					associationType: "issueIdOrKeys",
					values: ["ABC-1", "ABC-2"]
				},
				{
					associationType: "commit",
					values: [
						{
							commitHash: "6e87a40179eb7ecf5094b9c8d690db727472d5bc1",
							repositoryId: "65"
						},
						{
							commitHash: "6e87a40179eb7ecf5094b9c8d690db727472d5bc2",
							repositoryId: "65"
						}
					]
				}
			]));
		});

		it(`supports branch and merge workflows, sending zero commits in deployment when 500 issues`, async () => {

			//If we use old GH Client we won't call the API because we pass already "authenticated" client to the test method
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

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
				});

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status.payload as any, jiraHost, getLogger("deploymentLogger"), undefined);

			// make expected issue id array
			const expectedIssueIds = [...Array(500).keys()].map(number => "ABC-" + number);

			expect(jiraPayload).toMatchObject(buildJiraPayload([
				{
					associationType: "issueIdOrKeys",
					values: expectedIssueIds
				}
			]));
		});

		it(`uses user config to map environment`, async () => {

			//If we use old GH Client we won't call the API because we pass already "authenticated" client to the test method
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

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
			githubNock.get(`/repos/${owner.login}/${repoName}/deployments?environment=foo42&per_page=10`)
				.reply(200,
					[
						{
							id: 1,
							environment: "foo42",
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
				});

			when(getRepoConfig).calledWith(
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.anything()
			).mockResolvedValue(mockConfig);

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status_staging.payload as any, jiraHost, getLogger("deploymentLogger"), undefined);
			expect(jiraPayload?.deployments[0].environment.type).toBe("development");
		});

	});

	describe("server", () => {

		let gitHubClient: GitHubInstallationClient;

		beforeEach(async () => {
			const builderOutput = await new DatabaseStateCreator()
				.forServer()
				.create();

			gitHubClient = new GitHubInstallationClient(
				new InstallationId(gheUrl, builderOutput.gitHubServerApp!.appId, DatabaseStateCreator.GITHUB_INSTALLATION_ID),
				{
					hostname: gheUrl,
					baseUrl: gheUrl,
					apiUrl: gheApiUrl,
					graphqlUrl: gheApiUrl + "/graphql"
				},
				getLogger("test"),
				builderOutput.gitHubServerApp!.id
			);
		});

		it(`supports branch and merge workflows, sending related commits in deployment for Server`, async () => {

			turnOnGHESFF();

			when(booleanFlag).calledWith(
				BooleanFlags.USE_REPO_ID_TRANSFORMER,
				expect.anything()
			).mockResolvedValue(true);

			//If we use old GH Client we won't call the API because we pass already "authenticated" client to the test method
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

			// Mocking all GitHub API Calls
			// Get commit
			gheApiNock.get(`/repos/${owner.login}/${repoName}/commits/${deployment_status.payload.deployment.sha}`)
				.reply(200, {
					...owner,
					commit: {
						message: "testing"
					}
				});

			// List deployments
			gheApiNock.get(`/repos/${owner.login}/${repoName}/deployments?environment=Production&per_page=10`)
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
			gheApiNock.get(`/repos/${owner.login}/${repoName}/deployments/1/statuses?per_page=100`)
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
			gheApiNock.get(`/repos/${owner.login}/${repoName}/compare/6e87a40179eb7ecf5094b9c8d690db727472d5bc...${deployment_status.payload.deployment.sha}`)
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
				});

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status.payload as any, jiraHost, getLogger("deploymentLogger"), undefined);

			expect(jiraPayload).toMatchObject(buildJiraPayload([
				{
					associationType: "issueIdOrKeys",
					values: ["ABC-1", "ABC-2"]
				},
				{
					associationType: "commit",
					values: [
						{
							commitHash: "6e87a40179eb7ecf5094b9c8d690db727472d5bc1",
							repositoryId: "6769746875626d79646f6d61696e636f6d-65"
						},
						{
							commitHash: "6e87a40179eb7ecf5094b9c8d690db727472d5bc2",
							repositoryId: "6769746875626d79646f6d61696e636f6d-65"
						}
					]
				}
			]));
		});
	});
});
