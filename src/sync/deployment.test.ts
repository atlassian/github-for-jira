/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { removeInterceptor } from "nock";
import { processInstallation } from "./installation";
import { sqsQueues } from "../sqs/queues";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/sqs.types";

import deploymentNodesFixture from "fixtures/api/graphql/deployment-nodes.json";
import mixedDeploymentNodes from "fixtures/api/graphql/deployment-nodes-mixed.json";
import { getDeploymentsQuery, getDeploymentsQueryByCreatedAtDesc } from "~/src/github/client/github-queries";
import { waitUntil } from "test/utils/wait-until";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { GitHubServerApp } from "models/github-server-app";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { getDeploymentTask } from "./deployment";
import { RepoSyncState } from "models/reposyncstate";

jest.mock("../sqs/queues");
jest.mock("config/feature-flags");

describe("sync/deployments", () => {
	const installationId = DatabaseStateCreator.GITHUB_INSTALLATION_ID;
	const sentry: Hub = { setUser: jest.fn() } as any;
	const mockBackfillQueueSendMessage = jest.mocked(sqsQueues.backfill.sendMessage);
	const makeExpectedJiraResponse = (deployments) => ({
		deployments,
		properties: {
			"gitHubInstallationId": installationId
		},
		preventTransitions: true,
		operationType: "BACKFILL"
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

			githubUserTokenNock(installationId);
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

		it("should sync nothing to jira if all edges are earlier than fromDate -- when ff is on", async () => {

			when(booleanFlag).calledWith(
				BooleanFlags.USE_BACKFILL_ALGORITHM_INCREMENTAL,
				jiraHost
			).mockResolvedValue(true);

			githubNock
				.post("/graphql", {
					query: getDeploymentsQueryByCreatedAtDesc,
					variables: {
						owner: "integrations",
						repo: "test-repo-name",
						per_page: 20
					}
				})
				.query(true)
				.reply(200, deploymentNodesFixture);

			const gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, getLogger("test"), undefined);
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

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
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

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not call Jira if no issue keys are present", async () => {
			const data: BackfillMessagePayload = { installationId, jiraHost };

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
						message: "NO SMART COMMITS HERE test-commit-message"
					},
					html_url: `test-repo-url/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`
				});

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});

		it("should not call Jira if no data is returned", async () => {
			const data = { installationId, jiraHost };
			createGitHubNock();

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});
	});

	describe("server", () => {

		const createGitHubServerNock = (deploymentsResponse?) => {
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

			gheUserTokenNock(installationId);
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

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

	});

});
