/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/no-duplicates
import { mapEnvironment, mapState, transformDeployment } from "./transform-deployment";
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getInstallationId, InstallationId } from "../github/client/installation-id";
import deployment_status from "fixtures/deployment_status-basic.json";
import deployment_status_staging from "fixtures/deployment_status_staging.json";
import { getRepoConfig } from "services/user-config-service";
import { when } from "jest-when";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { shouldSendAll, booleanFlag, BooleanFlags } from "config/feature-flags";
import { cacheSuccessfulDeploymentInfo } from "services/deployment-cache-service";
import { Config } from "interfaces/common";
import { cloneDeep } from "lodash";

jest.mock("services/user-config-service");
jest.mock("config/feature-flags");

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

const mockConfigNoServices = {
	deployments: {
		environmentMapping: {
			development: [
				"foo*" // nonsense pattern to make sure that we're hitting it in the tests below
			]
		},
		services: {
			ids: []
		}
	}
};

const mockGetRepoConfig = () => {
	when(getRepoConfig).calledWith(
		expect.anything(),
		expect.anything(),
		expect.anything(),
		expect.anything(),
		expect.anything(),
		expect.anything()
	).mockResolvedValue(mockConfig);
};

const mockGetRepoConfigNoServices = () => {
	when(getRepoConfig).calledWith(
		expect.anything(),
		expect.anything(),
		expect.anything(),
		expect.anything(),
		expect.anything(),
		expect.anything()
	).mockResolvedValue(mockConfigNoServices);
};

const buildJiraPayload = (displayName="testing", associations) => {
	return {
		deployments: [{
			schemaVersion: "1.0",
			deploymentSequenceNumber: 1234,
			updateSequenceNumber: 123456,
			displayName: displayName,
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

describe.each([
	["success", "successful"],
	["SUCCESS", "successful"],
	["error", "failed"],
	["ERROR", "failed"],
	["FAILURE", "failed"],
	["failure", "failed"],
	["queued", "pending"],
	["QUEUED", "pending"],
	["WAITING", "pending"],
	["pending", "in_progress"],
	["PENDING", "in_progress"],
	["IN_PROGRESS", "in_progress"],
	["in_progress", "in_progress"],
	["INACTIVE", "unknown"],
	["whatever", "unknown"]
])("deployment state mapping", (src, dest) => {
	it(`should map origin state ${src} to ${dest}`, () => {
		expect(mapState(src)).toBe(dest);
	});
});

describe("deployment environment mapping", () => {

	it("pass with null env mapping correctly", () => {

		const userConfig = { deployments: { environmentMapping: { development: null, staging: "stg" } } };

		// match
		expect(mapEnvironment("stg", userConfig as any)).toBe("staging");

	});

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
		expect(mapEnvironment("develop")).toBe("development");

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
		expect(mapEnvironment("sta")).toBe("staging");
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

	it("classifies unknown user config entries as 'unmapped'", () => {
		const userConfig = {
			deployments: {
				environmentMapping: {
					// "prod" is not a valid key, it should be "production"
					prod: ["prod-*"]
				}
			}
		} as Config;

		expect(mapEnvironment("prod-us-west-1", userConfig)).toBe("unmapped");
	});
});

describe("transform GitHub webhook payload to Jira payload", () => {
	const { payload: { repository: { name: repoName, owner } } } = deployment_status;
	let gitHubClient: GitHubInstallationClient;

	describe("cloud", () => {

		beforeEach(async () => {
			gitHubClient = new GitHubInstallationClient(getInstallationId(DatabaseStateCreator.GITHUB_INSTALLATION_ID), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));

			await new DatabaseStateCreator().create();
		});

		it(`transforms deployments without issue keys`, async () => {
			when(shouldSendAll).calledWith("deployments", expect.anything(), expect.anything())
				.mockResolvedValue(true);
			const deploymentPayload = cloneDeep(deployment_status_staging.payload) as any;
			deploymentPayload.deployment.ref = "not-a-issue-key";
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
			githubNock.get(`/repos/${owner.login}/${repoName}/compare/6e87a40179eb7ecf5094b9c8d690db727472d5bc...${deploymentPayload.deployment.sha as string}`)
				.reply(200, { commits: [] });

			mockGetRepoConfigNoServices();

			const jiraPayload = await transformDeployment(gitHubClient, deploymentPayload, jiraHost, "webhook", getLogger("deploymentLogger"), undefined);

			expect(jiraPayload?.deployments[0].associations).toStrictEqual([]);
		});

		it(`uses user config to associate services`, async () => {

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

			mockGetRepoConfig();

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status_staging.payload as any, jiraHost, "webhook", getLogger("deploymentLogger"), undefined);


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

		it(`check if display name commit message cropped to 255 to fit api limit`, async () => {

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
						message: "Q4ua5dPnvDaW8CQgbnC7IiOQ8emND4bTv6ibK2Vh5LsGukmAF7VFE7MWZBwiPWON2fbqWL9q1jyjilgOMmt79WgMgDbT2opGlh6at5WfTYlYQVV77FXiLtPIOs8szN02ldD4slvScLRRynPQpzShisQpVfYU4PL5vCl2OzIYBIJ3zJJIY9g3EMSxtwe0rGaDBuINFBBgWYS2WOh8UAZxSR0w2wetYgq1Adv11Qy85rffGG3GkRHpFNvQ22n6JqpZx"
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

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status.payload as any, jiraHost, "webhook", getLogger("deploymentLogger"), undefined);

			expect(jiraPayload).toMatchObject(buildJiraPayload("Q4ua5dPnvDaW8CQgbnC7IiOQ8emND4bTv6ibK2Vh5LsGukmAF7VFE7MWZBwiPWON2fbqWL9q1jyjilgOMmt79WgMgDbT2opGlh6at5WfTYlYQVV77FXiLtPIOs8szN02ldD4slvScLRRynPQpzShisQpVfYU4PL5vCl2OzIYBIJ3zJJIY9g3EMSxtwe0rGaDBuINFBBgWYS2WOh8UAZxSR0w2wetYgq1Adv11Qy85rffGG3GkRHpFNvQ22n6Jqp",  [
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

		it(`skip sending commits association in deployment for Cloud when ff is on`, async () => {

			when(booleanFlag).calledWith(BooleanFlags.SKIP_SENDING_COMMIT_ASSOCIATION, expect.anything()).mockResolvedValue(true);

			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

			await cacheSuccessfulDeploymentInfo({
				gitHubBaseUrl: gitHubClient.baseUrl,
				repositoryId: deployment_status.payload.repository.id,
				commitSha: "6e87a40179eb7ecf5094b9c8d690db727472d5bc",
				env: "Production",
				createdAt: new Date(new Date(deployment_status.payload.deployment_status.created_at).getTime() - 1000)
			}, getLogger("deploymentLogger"));

			// Mocking all GitHub API Calls
			// Get commit
			githubNock.get(`/repos/${owner.login}/${repoName}/commits/${deployment_status.payload.deployment.sha}`)
				.reply(200, {
					...owner,
					commit: {
						message: "testing"
					}
				});

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

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status.payload as any, jiraHost, "webhook", getLogger("deploymentLogger"), undefined);

			expect(jiraPayload).toMatchObject(buildJiraPayload("testing",  [
				{
					associationType: "issueIdOrKeys",
					values: ["ABC-1", "ABC-2"]
				}
			]));
		});

		it(`supports branch and merge workflows, sending related commits in deploymentfor Cloud`, async () => {

			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

			await cacheSuccessfulDeploymentInfo({
				gitHubBaseUrl: gitHubClient.baseUrl,
				repositoryId: deployment_status.payload.repository.id,
				commitSha: "6e87a40179eb7ecf5094b9c8d690db727472d5bc",
				env: "Production",
				createdAt: new Date(new Date(deployment_status.payload.deployment_status.created_at).getTime() - 1000)
			}, getLogger("deploymentLogger"));

			// Mocking all GitHub API Calls
			// Get commit
			githubNock.get(`/repos/${owner.login}/${repoName}/commits/${deployment_status.payload.deployment.sha}`)
				.reply(200, {
					...owner,
					commit: {
						message: "testing"
					}
				});

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

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status.payload as any, jiraHost, "webhook", getLogger("deploymentLogger"), undefined);

			expect(jiraPayload).toMatchObject(buildJiraPayload("testing",  [
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

		// The number of values counted across all associationTypes (issueKeys, issueIdOrKeys and serviceIdOrKeys) must not exceed a limit of 500.
		// https://developer.atlassian.com/cloud/jira/software/rest/api-group-deployments/#api-rest-deployments-0-1-bulk-post
		describe("limits to 500 total", () => {
			beforeEach(() => {
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
			});

			it(`crops issue keys (505) to 500 (5 issue keys must be left aside)`, async () => {

				// make message with 500 issue ids to prove there isn't room in the submission for any associated commits
				const commitMessage = "ABC-" + [...Array(505).keys()].map(number => number + 1).join(" ABC-");

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

				const jiraPayload = await transformDeployment(gitHubClient, deployment_status.payload as any, jiraHost, "webhook", getLogger("deploymentLogger"), undefined);

				// make expected issue id array
				const expectedIssueIds = [...Array(500).keys()].map(number => "ABC-" + (number + 1).toString());

				expect(jiraPayload).toMatchObject(buildJiraPayload("testing", [
					{
						associationType: "issueIdOrKeys",
						values: expectedIssueIds
					}
				]));
			});

			it(`crops issue keys (499) and services (2) to 500 (one service must be left aside)`, async () => {
				// make message with 500 issue ids to prove there isn't room in the submission for any associated commits
				const commitMessage = "ABC-" + [...Array(499).keys()].map(number => number + 1).join(" ABC-");

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

				mockGetRepoConfig();

				const jiraPayload = await transformDeployment(gitHubClient, deployment_status.payload as any, jiraHost, "webhook", getLogger("deploymentLogger"), undefined);

				// make expected issue id array

				expect(jiraPayload).toMatchObject(buildJiraPayload("testing", [
					{
						associationType: "issueIdOrKeys",
						values: [...Array(499).keys()].map(number => "ABC-" + (number + 1).toString())
					},
					{
						associationType: "serviceIdOrKeys",
						values: ["service-id-1"] // 'service-id-2' should not be expected
					}
				]));
			});

			it(`crops issue keys (497), service ids (2) and commits (2) to 500 (one commit must be left aside)`, async () => {
				// make message with 500 issue ids to prove there isn't room in the submission for any associated commits
				const commitMessage = "ABC-" + [...Array(497).keys()].map(number => number + 1).join(" ABC-");

				// Compare commits
				githubNock.get(`/repos/${owner.login}/${repoName}/compare/6e87a40179eb7ecf5094b9c8d690db727472d5bc...${deployment_status.payload.deployment.sha}`)
					.reply(200, {
						commits: [
							{
								commit: {
									message: commitMessage
								},
								sha: "expected"
							},
							{
								commit: {
									message: commitMessage
								},
								sha: "notexpected"
							}
						]
					});

				when(getRepoConfig).calledWith(
					expect.anything(),
					expect.anything(),
					expect.anything(),
					expect.anything(),
					expect.anything(),
					expect.anything()
				).mockResolvedValue(mockConfig);

				const jiraPayload = await transformDeployment(gitHubClient, deployment_status.payload as any, jiraHost, "webhook", getLogger("deploymentLogger"), undefined);

				expect(jiraPayload).toMatchObject(buildJiraPayload("testing", [
					{
						associationType: "issueIdOrKeys",
						values: [...Array(497).keys()].map(number => "ABC-" + (number + 1).toString())
					},
					{
						associationType: "serviceIdOrKeys",
						values: ["service-id-1", "service-id-2"]
					},
					{
						associationType: "commit",
						values: [
							{
								repositoryId: "65",
								commitHash: "expected"
							}
						]
					}
				]));
			});
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

			mockGetRepoConfig();

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status_staging.payload as any, jiraHost, "webhook", getLogger("deploymentLogger"), undefined);
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
				jiraHost,
				{ trigger: "test" },
				getLogger("test"),
				builderOutput.gitHubServerApp!.id
			);
		});

		it(`supports branch and merge workflows, sending related commits in deployment for Server`, async () => {

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

			const jiraPayload = await transformDeployment(gitHubClient, deployment_status.payload as any, jiraHost, "webhook", getLogger("deploymentLogger"), undefined);

			expect(jiraPayload).toMatchObject(buildJiraPayload("testing", [
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
