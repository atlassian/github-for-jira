/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { removeInterceptor } from "nock";
import { processInstallation } from "./installation";
import { sqsQueues } from "../sqs/queues";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import commitNodesFixture from "fixtures/api/graphql/commit-nodes.json";
import mixedCommitNodes from "fixtures/api/graphql/commit-nodes-mixed.json";
import commitsNoKeys from "fixtures/api/graphql/commit-nodes-no-keys.json";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags, numberFlag, NumberFlags } from "config/feature-flags";
import { getCommitsQueryWithChangedFiles } from "~/src/github/client/github-queries";
import { waitUntil } from "test/utils/wait-until";
import { GitHubServerApp } from "models/github-server-app";
import { DatabaseStateCreator } from "test/utils/database-state-creator";

jest.mock("../sqs/queues");
jest.mock("config/feature-flags");

describe("sync/commits", () => {
	const sentry: Hub = { setUser: jest.fn() } as any;

	beforeEach(() => {
		mockSystemTime(12345678);
	});

	describe("for cloud", () => {
		const mockBackfillQueueSendMessage = jest.mocked(sqsQueues.backfill.sendMessage);

		const makeExpectedJiraResponse = (commits) => ({
			preventTransitions: true,
			repositories: [
				{
					commits,
					"id": "1",
					"name": "test-repo-name",
					"url": "test-repo-url",
					"updateSequenceId": 12345678
				}
			],
			properties: {
				"installationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID
			}
		});

		const createGitHubNock = (commitsResponse, variables?: Record<string, any>) => {
			githubNock
				.post("/graphql", {
					query: getCommitsQueryWithChangedFiles,
					variables: {
						owner: "integrations",
						repo: "test-repo-name",
						per_page: 20,
						...variables
					}
				})
				.query(true)
				.reply(200, commitsResponse);
		};

		const createJiraNock = (commits) => {
			jiraNock
				.post("/rest/devinfo/0.10/bulk", makeExpectedJiraResponse(commits))
				.reply(200);
		};

		beforeEach(async () => {
			await new DatabaseStateCreator()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForCommits()
				.create();

			jest.mocked(sqsQueues.backfill.sendMessage).mockResolvedValue(Promise.resolve());
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
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

		it("should sync to Jira when Commit Nodes have jira references", async () => {
			const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

			createGitHubNock(commitNodesFixture);
			const commits = [
				{
					"author": {
						"name": "test-author-name",
						"email": "test-author-email@example.com"
					},
					"authorTimestamp": "test-authored-date",
					"displayId": "test-o",
					"fileCount": 0,
					"hash": "test-oid",
					"id": "test-oid",
					"issueKeys": [
						"TES-17"
					],
					"message": "[TES-17] test-commit-message",
					"url": "https://github.com/test-login/test-repo/commit/test-sha",
					"updateSequenceId": 12345678
				}
			];
			createJiraNock(commits);

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should send Jira all commits that have Issue Keys", async () => {
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

			createGitHubNock(mixedCommitNodes);

			const commits = [
				{
					"author": {
						"name": "test-author-name",
						"email": "test-author-email@example.com"
					},
					"authorTimestamp": "test-authored-date",
					"displayId": "test-o",
					"fileCount": 3,
					"hash": "test-oid-1",
					"id": "test-oid-1",
					"issueKeys": [
						"TES-17"
					],
					"message": "[TES-17] test-commit-message",
					"url": "https://github.com/test-login/test-repo/commit/test-sha",
					"updateSequenceId": 12345678
				},
				{
					"author": {
						"avatar": "test-avatar-url",
						"name": "test-author-name",
						"email": "test-author-email@example.com"
					},
					"authorTimestamp": "test-authored-date",
					"displayId": "test-o",
					"fileCount": 0,
					"hash": "test-oid-2",
					"id": "test-oid-2",
					"issueKeys": [
						"TES-15"
					],
					"message": "[TES-15] another test-commit-message",
					"url": "https://github.com/test-login/test-repo/commit/test-sha",
					"updateSequenceId": 12345678
				},
				{
					"author": {
						"avatar": "test-avatar-url",
						"name": "test-author-name",
						"email": "test-author-email@example.com"
					},
					"authorTimestamp": "test-authored-date",
					"displayId": "test-o",
					"fileCount": 0,
					"hash": "test-oid-3",
					"id": "test-oid-3",
					"issueKeys": [
						"TES-14",
						"TES-15"
					],
					"message": "TES-14-TES-15 message with multiple keys",
					"url": "https://github.com/test-login/test-repo/commit/test-sha",
					"updateSequenceId": 12345678
				}
			];
			createJiraNock(commits);

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
			await verifyMessageSent(data);
		});

		it("should not call Jira if no issue keys are present", async () => {
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

			createGitHubNock(commitsNoKeys);

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});

		it("should not call Jira if no data is returned", async () => {
			const data = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
			createGitHubNock(commitsNoKeys);

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});

		describe("SYNC_MAIN_COMMIT_TIME_LIMIT FF is enabled", () => {
			let dateCutoff: Date;
			beforeEach(() => {
				const time = Date.now();
				const cutoff = 1000 * 60 * 60 * 24;
				mockSystemTime(time);
				dateCutoff = new Date(time - cutoff);

				when(numberFlag).calledWith(
					NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT,
					expect.anything(),
					expect.anything()
				).mockResolvedValue(cutoff);
			});

			it("should only get commits since date specified", async () => {
				const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };

				createGitHubNock(commitNodesFixture, { commitSince: dateCutoff.toISOString() });
				const commits = [
					{
						"author": {
							"name": "test-author-name",
							"email": "test-author-email@example.com"
						},
						"authorTimestamp": "test-authored-date",
						"displayId": "test-o",
						"fileCount": 0,
						"hash": "test-oid",
						"id": "test-oid",
						"issueKeys": [
							"TES-17"
						],
						"message": "[TES-17] test-commit-message",
						"url": "https://github.com/test-login/test-repo/commit/test-sha",
						"updateSequenceId": 12345678
					}
				];
				createJiraNock(commits);

				await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
				await verifyMessageSent(data);
			});


			describe("Commit history value is passed", () => {
				it("should use commit history depth parameter before feature flag time", async () => {

					const time = Date.now();
					const commitTimeLimitCutoff = 1000 * 60 * 60 * 72;
					mockSystemTime(time);
					const commitsFromDate = new Date(time - commitTimeLimitCutoff).toISOString();
					const data: BackfillMessagePayload = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost, commitsFromDate };

					createGitHubNock(commitNodesFixture, { commitSince: commitsFromDate });
					const commits = [
						{
							"author": {
								"name": "test-author-name",
								"email": "test-author-email@example.com"
							},
							"authorTimestamp": "test-authored-date",
							"displayId": "test-o",
							"fileCount": 0,
							"hash": "test-oid",
							"id": "test-oid",
							"issueKeys": [
								"TES-17"
							],
							"message": "[TES-17] test-commit-message",
							"url": "https://github.com/test-login/test-repo/commit/test-sha",
							"updateSequenceId": 12345678
						}
					];
					createJiraNock(commits);

					await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
					await verifyMessageSent(data);
				});
			});
		});
	});

	describe("for server",  () => {

		const createGitHubENock = (commitsResponse, variables?: Record<string, any>) => {
			gheNock
				.post("/api/graphql", {
					query: getCommitsQueryWithChangedFiles,
					variables: {
						owner: "integrations",
						repo: "test-repo-name",
						per_page: 20,
						...variables
					}
				})
				.query(true)
				.reply(200, commitsResponse);
		};

		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {
			when(jest.mocked(booleanFlag))
				.calledWith(BooleanFlags.GHE_SERVER, expect.anything(), expect.anything())
				.mockResolvedValue(true);

			when(jest.mocked(booleanFlag))
				.calledWith(BooleanFlags.USE_REPO_ID_TRANSFORMER, expect.anything())
				.mockResolvedValue(true);

			const builderResult = await new DatabaseStateCreator()
				.forServer()
				.withActiveRepoSyncState()
				.repoSyncStatePendingForCommits()
				.create();
			gitHubServerApp = builderResult.gitHubServerApp!;

			gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
		});

		const makeExpectedJiraResponse = async (commits) => ({
			preventTransitions: true,
			repositories: [
				{
					commits,
					"id": "6769746875626d79646f6d61696e636f6d-1",
					"name": "test-repo-name",
					"url": "test-repo-url",
					"updateSequenceId": 12345678
				}
			],
			properties: {
				"installationId": DatabaseStateCreator.GITHUB_INSTALLATION_ID
			}
		});

		const createJiraNock = async (commits) => {
			jiraNock
				.post("/rest/devinfo/0.10/bulk", await makeExpectedJiraResponse(commits))
				.reply(200);
		};

		it("should sync to Jira when Commit Nodes have jira references", async () => {

			const data: BackfillMessagePayload = {
				installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
				jiraHost,
				gitHubAppConfig: {
					uuid: gitHubServerApp.uuid,
					gitHubAppId: gitHubServerApp.id,
					appId: gitHubServerApp.appId,
					clientId: gitHubServerApp.gitHubClientId,
					gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
					gitHubApiUrl: gitHubServerApp.gitHubBaseUrl + "/v3/api"
				}
			};

			createGitHubENock(commitNodesFixture);
			const commits = [
				{
					"author": {
						"name": "test-author-name",
						"email": "test-author-email@example.com"
					},
					"authorTimestamp": "test-authored-date",
					"displayId": "test-o",
					"fileCount": 0,
					"hash": "test-oid",
					"id": "test-oid",
					"issueKeys": [
						"TES-17"
					],
					"message": "[TES-17] test-commit-message",
					"url": "https://github.com/test-login/test-repo/commit/test-sha",
					"updateSequenceId": 12345678
				}
			];
			await createJiraNock(commits);

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
		});

	});
});
