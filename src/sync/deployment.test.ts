/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { removeInterceptor, cleanAll as nockCleanAll } from "nock";
import { processInstallation } from "./installation";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/sqs.types";

import deploymentNodesFixture from "fixtures/api/graphql/deployment-nodes.json";
import mixedDeploymentNodes from "fixtures/api/graphql/deployment-nodes-mixed.json";
import { getDeploymentsQuery } from "~/src/github/client/github-queries";
import { waitUntil } from "test/utils/wait-until";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { GitHubServerApp } from "models/github-server-app";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { getDeploymentTask } from "./deployment";
import { RepoSyncState } from "models/reposyncstate";
import { GitHubInstallationClient } from "../github/client/github-installation-client";

jest.mock("config/feature-flags");
const logger = getLogger("test");

describe("sync/deployments", () => {
	const installationId = DatabaseStateCreator.GITHUB_INSTALLATION_ID;
	const sentry: Hub = { setUser: jest.fn() } as any;
	const mockBackfillQueueSendMessage = jest.fn();
	const makeExpectedJiraResponse = (deployments) => ({
		deployments,
		properties: {
			gitHubInstallationId: installationId,
			repositoryId: 1
		},
		preventTransitions: true,
		operationType: "BACKFILL"
	});
	describe.only("using dynamodb as cache", () => {

		//-- shared testing states --
		const PAGE_SIZE__TWO_ITEMS = 2;
		const DEPLOYMENT_CURSOR_EMPTY = undefined;
		let gitHubClient: GitHubInstallationClient;
		let repoSyncState: RepoSyncState;
		let deployments;

		//--helper funcs--
		const repoFromRepoSyncState = (repoSyncState: RepoSyncState) => ({
			id: repoSyncState.repoId,
			name: repoSyncState.repoName,
			full_name: repoSyncState.repoFullName,
			owner: { login: repoSyncState.repoOwner },
			html_url: repoSyncState.repoUrl,
			updated_at: repoSyncState.repoUpdatedAt?.toISOString()
		});
		const msgPayload = () => ({
			jiraHost,
			installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
			commitsFromDate: "2023-01-01T00:00:00Z"
		});
		//size up to 9 entities
		const createDeploymentsEntities = (size: number) => {
			deployments = "*".repeat(size).split("").map((_, idx)=> {
				const clone = JSON.parse(JSON.stringify(deploymentNodesFixture.data.repository.deployments.edges[0]));
				clone.cursor = `cursor:${idx + 1}`;
				clone.node.createdAt = `2023-01-0${idx + 1}T10:00:00Z`;
				clone.node.databaseId = `dbid-${idx + 1}`;
				clone.node.commitOid = `SHA${idx + 1}`;
				return clone;
			});
		};
		const getDeploymentsPageResponse = (items) => ({ "data": { "repository": { "deployments": { "edges": items } } } });
		const nockFetchingDeploymentgPagesGraphQL = (cursor, deployments) => {
			githubNock.post("/graphql", { query: getDeploymentsQuery, variables: { owner: repoSyncState.repoOwner, repo: repoSyncState.repoName, per_page: PAGE_SIZE__TWO_ITEMS, cursor } })
				.query(true).reply(200, getDeploymentsPageResponse(deployments));
		};
		const nockDeploymentListingApi = () => {
			"*".repeat(10).split("").forEach(() => {
				githubNock.get(`/repos/test-repo-owner/test-repo-name/deployments?environment=prod&per_page=10`)
					.reply(200, deployments.map((item, idx) => ({
						"id": item.node.databaseId,
						"sha": item.node.commitOid,
						"ref": "random",
						"task": `task for deployment ${idx + 1}`,
						"payload": {},
						"original_environment": item.node.environment,
						"environment": item.node.environment,
						"description": `description for deployment ${idx + 1}`,
						"creator": { "login": "test-repo-owner", "id": 1, "type": "User" },
						"created_at": item.node.createdAt,
						"updated_at": item.node.createdAt,
						"statuses_url": "random",
						"repository_url": "random",
						"transient_environment": false,
						"production_environment": true
					})));
				deployments.forEach((item, idx) => {
					githubNock.get(`/repos/test-repo-owner/test-repo-name/deployments/${item.node.databaseId}/statuses?per_page=100`)
						.reply(200, { "id": idx, "state": "success", "description": "random", "environment": item.node.environment });
				});
			});
			deployments.forEach((item, idx) => {
				githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/${item.node.commitOid}`)
					.reply(200, {
						commit: {
							author: { name: "random", email: "random", date: new Date() },
							message: `commit message [JIRA-${idx + 1}]`
						}, html_url: "random"
					});
			});
		};
		const nockDeploymentDetailApi = (deployments) => {
			"*".repeat(10).split("").forEach(() => {
				deployments.forEach((item, idx) => {
					githubNock.get(`/repos/test-repo-owner/test-repo-name/deployments/${item.node.databaseId}/statuses?per_page=100`)
						.reply(200, { "id": idx, "state": "success", "description": "random", "environment": item.node.environment });
					githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/${item.node.commitOid}`)
						.reply(200, {
							commit: {
								author: { name: "random", email: "random", date: new Date() },
								message: `commit message [JIRA-${idx + 1}]`
							}, html_url: "random"
						});
				});
			});
		};
		/*
		const nockCommitShaCompare = (sha1, sha2) => {
			const compareMsgIssueKey = `ISSUEKEY${sha1}${sha2}-100`;
			githubNock.get(`/repos/test-repo-owner/test-repo-name/compare/${sha1}...${sha2}`)
				.reply(200, { "total_commits": 1, "commits": [ { "sha": "whatever", "commit": { "message": `some message ${compareMsgIssueKey}` } } ] });
			return { compareMsgIssueKey };
		};
		*/

		//--helper funcs end --

		beforeEach(async () => {
			gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, logger, undefined);
			const dbState = await new DatabaseStateCreator().withActiveRepoSyncState().repoSyncStatePendingForDeployments().create();
			repoSyncState = dbState.repoSyncState!;
			"*".repeat(20).split("").forEach(() => githubUserTokenNock(installationId));
		});

		afterEach(async () => {
			nockCleanAll();
		});

		describe("when ff is on", () => {
			describe("for empty demployment cursor", () => {
			});
			describe("for existing legacy (string) deployment cursor", () => {
			});
			describe("for new (json-object) deployment cursor", () => {
			});
		});
		describe.only("when ff is off", () => {
			describe("for empty demployment cursor", () => {
				it("should fetch deployments from begining", async () => {
					createDeploymentsEntities(4);
					nockFetchingDeploymentgPagesGraphQL(DEPLOYMENT_CURSOR_EMPTY, [deployments[3], deployments[2]]);
					nockDeploymentListingApi();
					nockDeploymentDetailApi([deployments[3], deployments[2]]);
					const result = await getDeploymentTask(logger, gitHubClient, jiraHost, repoFromRepoSyncState(repoSyncState), DEPLOYMENT_CURSOR_EMPTY, PAGE_SIZE__TWO_ITEMS, msgPayload());
					expect(result).toEqual(expect.objectContaining({ edges: [deployments[3], deployments[2]] }));
				});
			});
			describe("for existing legacy (string) deployment cursor", () => {
				it("should fetch deployments from legacy cursor", async () => {
					createDeploymentsEntities(4);
					nockFetchingDeploymentgPagesGraphQL(deployments[2].cursor, [deployments[1], deployments[0]]);
					nockDeploymentListingApi();
					nockDeploymentDetailApi([deployments[1], deployments[0]]);
					const result = await getDeploymentTask(logger, gitHubClient, jiraHost, repoFromRepoSyncState(repoSyncState), deployments[2].cursor, PAGE_SIZE__TWO_ITEMS, msgPayload());
					expect(result).toEqual(expect.objectContaining({ edges: [deployments[1], deployments[0]] }));
				});
			});
			describe("for new (json-object) deployment cursor", () => {
			});
		});
	});

	describe("cloud", () => {

		const createGitHubNock = (deploymentsResponse?) => {
			githubNock
				.post("/graphql", {
					query: getDeploymentsQuery,
					variables: {
						owner: "integrations",
						repo: "test-repo-name",
						per_page: 20
					}
				})
				.query(true)
				.reply(200, deploymentsResponse);
			githubUserTokenNock(installationId);
		};

		const createJiraNock = (deployments) => {
			jiraNock
				.post("/rest/deployments/0.1/bulk", makeExpectedJiraResponse(deployments))
				.reply(200);
		};

		let repoSyncState: RepoSyncState;

		beforeEach(async () => {

			mockSystemTime(12345678);

			const dbState = await new DatabaseStateCreator()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForDeployments()
				.create();
			repoSyncState = dbState.repoSyncState!;
		});

		const verifyMessageSent = async (data: BackfillMessagePayload, delaySec ?: number) => {
			await waitUntil(async () => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
			});
			expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
			expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(data);
			expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(delaySec || 0);
		};

		it("should sync nothing to jira if all edges are earlier than fromDate", async () => {

			githubUserTokenNock(installationId);
			githubNock
				.post("/graphql", {
					query: getDeploymentsQuery,
					variables: {
						owner: "integrations",
						repo: "test-repo-name",
						per_page: 20
					}
				})
				.query(true)
				.reply(200, deploymentNodesFixture);

			const gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, getLogger("test"), undefined);
			expect(await getDeploymentTask(getLogger("test"),
				gitHubClient,
				jiraHost,
				{
					id: repoSyncState.repoId,
					name: repoSyncState.repoName,
					full_name: repoSyncState.repoFullName,
					owner: { login: repoSyncState.repoOwner },
					html_url: repoSyncState.repoUrl,
					updated_at: repoSyncState.repoUpdatedAt?.toISOString()
				},
				undefined,
				20,
				{
					jiraHost,
					installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
					commitsFromDate: "2023-01-01T00:00:00Z"
				}
			)).toEqual({
				edges: []
			});
		});

		it("should sync to Jira when Deployment messages have jira references", async () => {
			const data: BackfillMessagePayload = { installationId, jiraHost };

			githubUserTokenNock(installationId);
			githubUserTokenNock(installationId);
			githubUserTokenNock(installationId);
			githubUserTokenNock(installationId);

			createGitHubNock(deploymentNodesFixture);

			githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`)
				.reply(200, {
					commit: {
						author: {
							name: "test-branch-author-name",
							email: "test-branch-author-name@github.com",
							date: "test-branch-author-date"
						},
						message: "[TEST-123] test-commit-message"
					},
					html_url: `test-repo-url/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`
				});

			githubNock.get(`/repos/test-repo-owner/test-repo-name/deployments`)
				.query(true)
				.reply(200, [
					{
						"id": 1,
						"sha": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
						"ref": "topic-branch",
						"task": "[TEST-123] test-commit-message",
						"payload": {},
						"original_environment": "staging",
						"environment": "production",
						"description": "Deploy request from hubot",
						"creator": {
							"login": "test-repo-owner",
							"id": 1,
							"type": "User"
						},
						"created_at": "2012-07-20T01:19:13Z",
						"updated_at": "2012-07-20T01:19:13Z",
						"statuses_url": "https://api.github.com/repos/octocat/example/deployments/1/statuses",
						"repository_url": "https://api.github.com/repos/octocat/example",
						"transient_environment": false,
						"production_environment": true
					}
				]);

			githubNock.get(`/repos/test-repo-owner/test-repo-name/compare/a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d...51e16759cdac67b0d2a94e0674c9603b75a840f6`)
				.reply(200, {
					"total_commits": 2,
					"commits": [
						{
							"sha": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
							"commit": {
								"message": "base commit"
							}
						},
						{
							"sha": "51e16759cdac67b0d2a94e0674c9603b75a840f6",
							"commit": {
								"message": "head commit"
							}
						}
					]
				});

			githubNock.get(`/repos/test-repo-owner/test-repo-name/deployments/1/statuses`)
				.query(true)
				.reply(200, [
					{
						"id": 1,
						"state": "success",
						"description": "Deployment finished successfully.",
						"environment": "production"
					}
				]);

			createJiraNock([{
				"schemaVersion": "1.0",
				"deploymentSequenceNumber": 500226426,
				"updateSequenceNumber": 500226426,
				"displayName": "[TEST-123] test-commit-message",
				"url": "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks",
				"description": "deploy",
				"lastUpdated": "2022-02-03T22:45:04.000Z",
				"state": "successful",
				"pipeline": {
					"id": "deploy",
					"displayName": "deploy",
					"url": "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks"
				},
				"environment": {
					"id": "prod",
					"displayName": "prod",
					"type": "production"
				},
				"associations": [
					{
						"associationType": "issueIdOrKeys",
						"values": ["TEST-123"]
					},
					{
						"associationType": "commit",
						"values": [
							{
								"commitHash": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
								"repositoryId": "19"
							},
							{
								"commitHash": "51e16759cdac67b0d2a94e0674c9603b75a840f6",
								"repositoryId": "19"
							}
						]
					}]
			}]);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should send Jira all deployments that have Issue Keys", async () => {
			const data = { installationId, jiraHost };

			createGitHubNock(mixedDeploymentNodes);

			["51e16759cdac67b0d2a94e0674c9603b75a840f6", "7544f2fec0321a32d5effd421682463c2ebd5018"]
				.forEach((commitId, index) => {
					index++;
					githubUserTokenNock(installationId);
					githubUserTokenNock(installationId);
					githubUserTokenNock(installationId);
					githubUserTokenNock(installationId);
					githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/${commitId}`)
						.reply(200, {
							commit: {
								author: {
									name: "test-branch-author-name",
									email: "test-branch-author-name@github.com",
									date: "test-branch-author-date"
								},
								message: `[TEST-${index * 123}] test-commit-message ${index}`
							},
							html_url: `test-repo-url/commits/${commitId}`
						});

					githubNock.get(`/repos/test-repo-owner/test-repo-name/deployments`)
						.query(true)
						.reply(200, [
							{
								"id": 1,
								"sha": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
								"ref": "topic-branch",
								"task": "deploy",
								"payload": {},
								"original_environment": "staging",
								"environment": "production",
								"description": "Deploy request from hubot",
								"creator": {
									"login": "test-repo-owner",
									"id": 1,
									"type": "User"
								},
								"created_at": "2012-07-20T01:19:13Z",
								"updated_at": "2012-07-20T01:19:13Z",
								"statuses_url": "https://api.github.com/repos/octocat/example/deployments/1/statuses",
								"repository_url": "https://api.github.com/repos/octocat/example",
								"transient_environment": false,
								"production_environment": true
							}
						]);

					githubNock.get(`/repos/test-repo-owner/test-repo-name/compare/a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d...${commitId}`)
						.reply(200, {
							"total_commits": 2,
							"commits": [
								{
									"sha": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
									"commit": {
										"message": "base commit"
									}
								},
								{
									"sha": commitId,
									"commit": {
										"message": "head commit"
									}
								}
							]
						});

					githubNock.get(`/repos/test-repo-owner/test-repo-name/deployments/1/statuses`)
						.query(true)
						.reply(200, [
							{
								"id": 1,
								"state": "success",
								"description": "Deployment finished successfully.",
								"environment": "production"
							}
						]);
				});

			createJiraNock([
				{
					schemaVersion: "1.0",
					deploymentSequenceNumber: 500226426,
					updateSequenceNumber: 500226426,
					displayName: "[TEST-123] test-commit-message 1",
					url: "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks",
					description: "deploy",
					lastUpdated: "2022-02-03T22:45:04.000Z",
					state: "successful",
					pipeline: {
						id: "deploy",
						displayName: "deploy",
						url: "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks"
					},
					environment: {
						id: "prod",
						displayName: "prod",
						type: "production"
					},
					associations: [
						{
							associationType: "issueIdOrKeys",
							values: ["TEST-123"]
						},
						{
							associationType: "commit",
							values: [
								{
									commitHash: "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
									repositoryId: "24"
								},
								{
									commitHash: "51e16759cdac67b0d2a94e0674c9603b75a840f6",
									repositoryId: "24"
								}
							]
						}
					]
				},
				{
					schemaVersion: "1.0",
					deploymentSequenceNumber: 1234,
					updateSequenceNumber: 1234,
					displayName: "[TEST-246] test-commit-message 2",
					url: "https://github.com/test-repo-owner/test-repo-name/commit/7544f2fec0321a32d5effd421682463c2ebd5018/checks",
					description: "deploy",
					lastUpdated: "2022-02-03T22:45:04.000Z",
					state: "successful",
					pipeline: {
						id: "deploy",
						displayName: "deploy",
						url: "https://github.com/test-repo-owner/test-repo-name/commit/7544f2fec0321a32d5effd421682463c2ebd5018/checks"
					},
					environment: {
						id: "prod",
						displayName: "prod",
						type: "production"
					},
					associations: [
						{
							associationType: "issueIdOrKeys",
							values: ["TEST-246"]
						},
						{
							associationType: "commit",
							values: [
								{
									commitHash: "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
									repositoryId: "42"
								},
								{
									commitHash: "7544f2fec0321a32d5effd421682463c2ebd5018",
									repositoryId: "42"
								}
							]
						}
					]
				}
			]);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not call Jira if no issue keys are present", async () => {
			const data: BackfillMessagePayload = { installationId, jiraHost };

			createGitHubNock(deploymentNodesFixture);

			githubUserTokenNock(installationId);
			githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`)
				.reply(200, {
					commit: {
						author: {
							name: "test-branch-author-name",
							email: "test-branch-author-name@github.com",
							date: "test-branch-author-date"
						},
						message: "NO SMART COMMITS HERE test-commit-message"
					},
					html_url: `test-repo-url/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`
				});

			githubUserTokenNock(installationId);
			githubNock.get(`/repos/test-repo-owner/test-repo-name/deployments`)
				.query(true)
				.reply(200, []);

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});

		it("should not call Jira if no data is returned", async () => {
			const data = { installationId, jiraHost };

			createGitHubNock({
				data: {
					repository: {
						deployments: {
							edges: []
						}
					}
				}
			});

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});
	});

	describe("server", () => {

		const createGitHubServerNock = (deploymentsResponse?) => {
			gheUserTokenNock(installationId);
			gheNock
				.post("/api/graphql", {
					query: getDeploymentsQuery,
					variables: {
						owner: "integrations",
						repo: "test-repo-name",
						per_page: 20
					}
				})
				.query(true)
				.reply(200, deploymentsResponse);
		};

		const createJiraNock = (deployments) => {
			jiraNock
				.post("/rest/deployments/0.1/bulk", makeExpectedJiraResponse(deployments))
				.reply(200);
		};

		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {

			mockSystemTime(12345678);

			const builderOutput = await new DatabaseStateCreator()
				.forServer()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForDeployments()
				.create();

			gitHubServerApp = builderOutput.gitHubServerApp!;
		});

		const verifyMessageSent = async (data: BackfillMessagePayload, delaySec ?: number) => {
			await waitUntil(async () => {
				expect(gheApiNock).toBeDone();
				expect(jiraNock).toBeDone();
			});
			expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
			expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(data);
			expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(delaySec || 0);
		};

		it("should sync to Jira when Deployment messages have jira references", async () => {
			const data: BackfillMessagePayload = { installationId, jiraHost, gitHubAppConfig: {
				gitHubAppId: gitHubServerApp.id,
				appId: gitHubServerApp.appId,
				clientId: gitHubServerApp.gitHubClientId,
				gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
				gitHubApiUrl: gitHubServerApp.gitHubBaseUrl + "/api/v3",
				uuid: gitHubServerApp.uuid
			} };

			gheUserTokenNock(installationId);
			gheUserTokenNock(installationId);
			gheUserTokenNock(installationId);
			gheUserTokenNock(installationId);

			createGitHubServerNock(deploymentNodesFixture);

			gheApiNock.get(`/repos/test-repo-owner/test-repo-name/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`)
				.reply(200, {
					commit: {
						author: {
							name: "test-branch-author-name",
							email: "test-branch-author-name@github.com",
							date: "test-branch-author-date"
						},
						message: "[TEST-123] test-commit-message"
					},
					html_url: `test-repo-url/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`
				});

			gheApiNock.get(`/repos/test-repo-owner/test-repo-name/deployments`)
				.query(true)
				.reply(200, [
					{
						"id": 1,
						"sha": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
						"ref": "topic-branch",
						"task": "[TEST-123] test-commit-message",
						"payload": {},
						"original_environment": "staging",
						"environment": "production",
						"description": "Deploy request from hubot",
						"creator": {
							"login": "test-repo-owner",
							"id": 1,
							"type": "User"
						},
						"created_at": "2012-07-20T01:19:13Z",
						"updated_at": "2012-07-20T01:19:13Z",
						"statuses_url": "https://api.github.com/repos/octocat/example/deployments/1/statuses",
						"repository_url": "https://api.github.com/repos/octocat/example",
						"transient_environment": false,
						"production_environment": true
					}
				]);

			gheApiNock.get(`/repos/test-repo-owner/test-repo-name/compare/a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d...51e16759cdac67b0d2a94e0674c9603b75a840f6`)
				.reply(200, {
					"total_commits": 2,
					"commits": [
						{
							"sha": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
							"commit": {
								"message": "base commit"
							}
						},
						{
							"sha": "51e16759cdac67b0d2a94e0674c9603b75a840f6",
							"commit": {
								"message": "head commit"
							}
						}
					]
				});

			gheApiNock.get(`/repos/test-repo-owner/test-repo-name/deployments/1/statuses`)
				.query(true)
				.reply(200, [
					{
						"id": 1,
						"state": "success",
						"description": "Deployment finished successfully.",
						"environment": "production"
					}
				]);

			createJiraNock([{
				"schemaVersion": "1.0",
				"deploymentSequenceNumber": 500226426,
				"updateSequenceNumber": 500226426,
				"displayName": "[TEST-123] test-commit-message",
				"url": "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks",
				"description": "deploy",
				"lastUpdated": "2022-02-03T22:45:04.000Z",
				"state": "successful",
				"pipeline": {
					"id": "deploy",
					"displayName": "deploy",
					"url": "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks"
				},
				"environment": {
					"id": "prod",
					"displayName": "prod",
					"type": "production"
				},
				"associations": [
					{
						"associationType": "issueIdOrKeys",
						"values": ["TEST-123"]
					},
					{
						"associationType": "commit",
						"values": [
							{
								"commitHash": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
								"repositoryId": "6769746875626d79646f6d61696e636f6d-19"
							},
							{
								"commitHash": "51e16759cdac67b0d2a94e0674c9603b75a840f6",
								"repositoryId": "6769746875626d79646f6d61696e636f6d-19"
							}
						]
					}]
			}]);

			await expect(processInstallation(mockBackfillQueueSendMessage)(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

	});

});
