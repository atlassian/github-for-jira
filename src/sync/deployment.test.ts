/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { removeInterceptor, cleanAll as nockCleanAll } from "nock";
import { processInstallation } from "./installation";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { dynamodb as ddb } from "config/dynamodb";
import { createHashWithoutSharedSecret } from "utils/encryption";
import { envVars } from "config/env";

import deploymentNodesFixture from "fixtures/api/graphql/deployment-nodes.json";
import mixedDeploymentNodes from "fixtures/api/graphql/deployment-nodes-mixed.json";
import { DeploymentQueryNode, getDeploymentsQueryWithStatuses } from "~/src/github/client/github-queries";
import { waitUntil } from "test/utils/wait-until";
import { DatabaseStateCreator, CreatorResult } from "test/utils/database-state-creator";
import { GitHubServerApp } from "models/github-server-app";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { getDeploymentTask } from "./deployment";
import { RepoSyncState } from "models/reposyncstate";
import { GitHubInstallationClient } from "../github/client/github-installation-client";

jest.mock("config/feature-flags");
const logger = getLogger("test");
const lastMockedDeploymentSubmitFn = jest.fn();
jest.mock("../jira/client/jira-client", () => ({
	getJiraClient: async (...args) => {
		const actual = await jest.requireActual("../jira/client/jira-client").getJiraClient(...args);
		return {
			...actual,
			deployment: {
				...actual.deployment,
				submit: (...repoArgs) => {
					lastMockedDeploymentSubmitFn(...repoArgs);
					return actual.deployment.submit(...repoArgs);
				}
			}
		};
	}
}));

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
	describe("using dynamodb as cache", () => {

		//-- shared testing states --
		const PAGE_SIZE__TWO_ITEMS = 2;
		const DEPLOYMENT_CURSOR_EMPTY = undefined;
		const REPEAT_ONCE = 1;
		const REPEAT_LOTS_OF_TIME = 20;
		let gitHubClient: GitHubInstallationClient;
		let repoSyncState: RepoSyncState;
		let repositoryData;

		beforeEach(async () => {

			gitHubClient = await createInstallationClient(DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, { trigger: "test" }, logger, undefined);

			const dbState = await new DatabaseStateCreator().withActiveRepoSyncState().repoSyncStatePendingForDeployments().create();

			repoSyncState = dbState.repoSyncState!;
			repositoryData = {
				id: repoSyncState.repoId,
				name: repoSyncState.repoName,
				full_name: repoSyncState.repoFullName,
				owner: { login: repoSyncState.repoOwner },
				html_url: repoSyncState.repoUrl,
				updated_at: repoSyncState.repoUpdatedAt?.toISOString()
			};

			Array.from({ length: REPEAT_LOTS_OF_TIME }).forEach(() => githubUserTokenNock(installationId));
		});

		afterEach(async () => {
			nockCleanAll();
		});

		describe("syncing deployments", () => {

			it("should get the url from previous NON-INACTIVE status", async () => {

				const deploymentCount = 4;
				const deployments = createDeploymentEntities(deploymentCount);

				nockFetchingDeploymentgPagesGraphQL(getDeploymentsQueryWithStatuses, DEPLOYMENT_CURSOR_EMPTY, [deployments[3], deployments[2]]);
				nockFetchingDeploymentgPagesGraphQL(getDeploymentsQueryWithStatuses, deployments[2].cursor, [deployments[1], deployments[0]]); //this is for extra page when fetching current deployments

				nockDeploymentCommitGetApi([deployments[3], deployments[2]], REPEAT_ONCE);

				const result = await getDeploymentTask(logger, gitHubClient, jiraHost, repositoryData, DEPLOYMENT_CURSOR_EMPTY, PAGE_SIZE__TWO_ITEMS, msgPayload());

				expect(result.jiraPayload?.deployments).toEqual([
					expect.objectContaining({
						url: "deployment-url-4",
						pipeline: expect.objectContaining({
							url: "deployment-url-4"
						})
					}),
					expect.objectContaining({
						url: "deployment-url-3",
						pipeline: expect.objectContaining({
							url: "deployment-url-3"
						})
					})
				]);
			});

			it("should get the correct state from previous NON-INACTIVE status", async () => {

				const deploymentCount = 4;
				const deployments = createDeploymentEntities(deploymentCount);

				nockFetchingDeploymentgPagesGraphQL(getDeploymentsQueryWithStatuses, DEPLOYMENT_CURSOR_EMPTY, [deployments[3], deployments[2]]);
				nockFetchingDeploymentgPagesGraphQL(getDeploymentsQueryWithStatuses, deployments[2].cursor, [deployments[1], deployments[0]]); //this is for extra page when fetching current deployments

				nockDeploymentCommitGetApi([deployments[3], deployments[2]], REPEAT_ONCE);

				const result = await getDeploymentTask(logger, gitHubClient, jiraHost, repositoryData, DEPLOYMENT_CURSOR_EMPTY, PAGE_SIZE__TWO_ITEMS, msgPayload());

				expect(result.jiraPayload?.deployments).toEqual([
					expect.objectContaining({
						state: "successful"
					}),
					expect.objectContaining({
						state: "successful"
					})
				]);
			});

			// eslint-disable-next-line jest/expect-expect
			it("should save deployments to dynamodb and process WITHOUT calling rest listing api", async () => {

				const deploymentCount = 4;
				const deployments = createDeploymentEntities(deploymentCount);

				nockFetchingDeploymentgPagesGraphQL(getDeploymentsQueryWithStatuses, DEPLOYMENT_CURSOR_EMPTY, [deployments[3], deployments[2]]);
				nockFetchingDeploymentgPagesGraphQL(getDeploymentsQueryWithStatuses, deployments[2].cursor, [deployments[1], deployments[0]]); //this is for extra page when fetching current deployments

				nockDeploymentCommitGetApi([deployments[3], deployments[2]], REPEAT_ONCE);

				const result = await getDeploymentTask(logger, gitHubClient, jiraHost, repositoryData, DEPLOYMENT_CURSOR_EMPTY, PAGE_SIZE__TWO_ITEMS, msgPayload());

				await expectDeploymentEntryInDB([deployments[3], deployments[2]]);
				expectEdgesAndPayloadMatchToDeploymentCommits(result, [deployments[3], deployments[2]]);

			});
		});

		//--helper funcs--
		const msgPayload = () => ({
			jiraHost,
			installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
			commitsFromDate: "2023-01-01T00:00:00Z"
		});

		//size up to 9 entities
		const createDeploymentEntities = (size: number) => {
			return Array.from({ length: size }).map((_, idx) => {
				const clone: DeploymentQueryNode = JSON.parse(JSON.stringify(deploymentNodesFixture.data.repository.deployments.edges[0]));
				clone.cursor = `${idx + 1}`;
				clone.node.createdAt = `2023-01-0${idx + 1}T10:00:00Z`;
				clone.node.updatedAt = `2023-01-0${idx + 1}T10:00:00Z`;
				clone.node.databaseId = `dbid-${idx + 1}`;
				clone.node.commitOid = `SHA${idx + 1}`;
				clone.node.statuses!.nodes.forEach(n => {
					n.createdAt = clone.node.createdAt;
					n.updatedAt = clone.node.updatedAt!;
					if (n.state === "SUCCESS") {
						n.logUrl = `deployment-url-${idx + 1}`;
					}
				});
				return clone;
			});
		};

		const nockFetchingDeploymentgPagesGraphQL = (query, cursor, deployments) => {
			githubNock.post("/graphql", { query, variables: { owner: repoSyncState.repoOwner, repo: repoSyncState.repoName, per_page: PAGE_SIZE__TWO_ITEMS, cursor } })
				.query(true).reply(200, { data: { repository: { deployments: { edges: deployments } } } });
		};

		const nockDeploymentCommitGetApi = (deployments: DeploymentQueryNode[], repeatTimes: number) => {
			Array.from({ length: repeatTimes }).forEach(() => {
				deployments.forEach(item => {
					githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/${item.node.commitOid}`)
						.reply(200, {
							commit: {
								author: { name: "random", email: "random", date: new Date() },
								message: `commit message [JIRA-${item.cursor}]`
							}, html_url: "random"
						});
				});
			});
		};

		const expectDeploymentEntryInDB = async (deployments: DeploymentQueryNode[]) => {
			for (const deployment of deployments) {
				const { repository: { id: repoId }, environment, statuses, commitOid } = deployment.node;
				const key = createHashWithoutSharedSecret(`ghurl_${gitHubCloudConfig.baseUrl}_repo_${repoId}_env_${environment}`);
				const successStatusDate = new Date(statuses!.nodes.find(n=>n.state === "SUCCESS")!.updatedAt).getTime();
				const result = await ddb.getItem({
					TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME,
					Key: {
						Id: { "S": key },
						CreatedAt: { "N": String(successStatusDate) }
					},
					AttributesToGet: [ "CommitSha" ]
				}).promise();
				expect(result.$response.error).toBeNull();
				expect(result.Item).toEqual({ CommitSha: { "S": commitOid } });
			}
		};

		const expectEdgesAndPayloadMatchToDeploymentCommits = (result, deployments: DeploymentQueryNode[]) => {
			expect(result).toEqual({
				edges: deployments.map(d =>
					expect.objectContaining({ cursor: d.cursor, node: expect.objectContaining({ commitOid: d.node.commitOid }) })
				),
				jiraPayload: {
					deployments: deployments.map(d => expect.objectContaining({
						associations: [{ associationType: "issueIdOrKeys", values: [ `JIRA-${d.cursor}`] }] })
					)
				}
			});
		};
		//--helper funcs end --
	});

	describe("cloud", () => {

		const createGitHubNock = (deploymentsResponse?, cursor?: string) => {
			githubNock
				.post("/graphql", {
					query: getDeploymentsQueryWithStatuses,
					variables: {
						owner: "integrations",
						repo: "test-repo-name",
						per_page: 20,
						cursor
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
		let dbState: CreatorResult;

		beforeEach(async () => {

			mockSystemTime(12345678);

			dbState = await new DatabaseStateCreator()
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

			createGitHubNock(deploymentNodesFixture);
			const lastEdges = deploymentNodesFixture.data.repository.deployments.edges;
			createGitHubNock({ data: { repository: { deployments: { edges: [] } } } }, lastEdges[lastEdges.length -1].cursor);

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
			const lastEdges = deploymentNodesFixture.data.repository.deployments.edges;
			createGitHubNock({ data: { repository: { deployments: { edges: [] } } } }, lastEdges[lastEdges.length -1].cursor);

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
				"url": "random-success",
				"description": "deploy",
				"lastUpdated": "2022-02-03T22:45:04.000Z",
				"state": "successful",
				"pipeline": {
					"id": "deploy",
					"displayName": "deploy",
					"url": "random-success"
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

			expect(lastMockedDeploymentSubmitFn).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
				auditLogsource: "BACKFILL",
				entityAction: "DEPLOYMENT",
				subscriptionId: dbState.subscription.id
			}));
		});

		it("should send Jira all deployments that have Issue Keys", async () => {
			const data = { installationId, jiraHost };

			createGitHubNock(mixedDeploymentNodes);
			const lastEdges = deploymentNodesFixture.data.repository.deployments.edges;
			createGitHubNock({ data: { repository: { deployments: { edges: [] } } } }, lastEdges[lastEdges.length -1].cursor);

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
			const lastEdges = deploymentNodesFixture.data.repository.deployments.edges;
			createGitHubNock({ data: { repository: { deployments: { edges: [] } } } }, lastEdges[lastEdges.length -1].cursor);

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

		const createGitHubServerNock = (deploymentsResponse?, cursor?: string) => {
			gheUserTokenNock(installationId);
			gheNock
				.post("/api/graphql", {
					query: getDeploymentsQueryWithStatuses,
					variables: {
						owner: "integrations",
						repo: "test-repo-name",
						per_page: 20,
						cursor
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
			const lastEdges = deploymentNodesFixture.data.repository.deployments.edges;
			createGitHubServerNock({ data: { repository: { deployments: { edges: [] } } } }, lastEdges[lastEdges.length -1].cursor);

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
				"url": "random-success",
				"description": "deploy",
				"lastUpdated": "2022-02-03T22:45:04.000Z",
				"state": "successful",
				"pipeline": {
					"id": "deploy",
					"displayName": "deploy",
					"url": "random-success"
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
