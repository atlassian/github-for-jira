/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { removeInterceptor } from "nock";
import { processInstallation } from "./installation";
import { Installation } from "models/installation";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
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
import fs from "fs";
import path from "path";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";

jest.mock("../sqs/queues");
jest.mock("config/feature-flags");

describe("sync/commits", () => {
	const sentry: Hub = { setUser: jest.fn() } as any;

	beforeEach(() => {
		mockSystemTime(12345678);
	});

	describe("for cloud", () => {
		const installationId = 1234;
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
				"installationId": 1234
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
			await Installation.create({
				gitHubInstallationId: installationId,
				jiraHost,
				encryptedSharedSecret: "secret",
				clientKey: "client-key"
			});

			const subscription = await Subscription.create({
				gitHubInstallationId: installationId,
				jiraHost,
				syncStatus: "ACTIVE",
				repositoryStatus: "complete"
			});

			await RepoSyncState.create({
				subscriptionId: subscription.id,
				repoId: 1,
				repoName: "test-repo-name",
				repoOwner: "integrations",
				repoFullName: "test-repo-name",
				repoUrl: "test-repo-url",
				repoPushedAt: new Date(),
				repoUpdatedAt: new Date(),
				repoCreatedAt: new Date(),
				branchStatus: "complete",
				commitStatus: "pending", // We want the next process to be commits
				pullStatus: "complete",
				updatedAt: new Date(),
				createdAt: new Date()
			});

			jest.mocked(sqsQueues.backfill.sendMessage).mockResolvedValue(Promise.resolve());
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

		it("should sync to Jira when Commit Nodes have jira references", async () => {
			const data: BackfillMessagePayload = { installationId, jiraHost };

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
			const data = { installationId, jiraHost };

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
			const data = { installationId, jiraHost };

			createGitHubNock(commitsNoKeys);

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
			expect(scope).not.toBeDone();
			removeInterceptor(interceptor);
		});

		it("should not call Jira if no data is returned", async () => {
			const data = { installationId, jiraHost };
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
				const data: BackfillMessagePayload = { installationId, jiraHost };

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
					const data: BackfillMessagePayload = { installationId, jiraHost, commitsFromDate };

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
		const installationIdForGhes = 12345;

		let subscriptionForGhe: Subscription;
		let gitHubServerApp: GitHubServerApp;
		let installationForGhes: Installation;

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

		beforeEach(async () => {
			when(jest.mocked(booleanFlag))
				.calledWith(BooleanFlags.GHE_SERVER, expect.anything(), expect.anything())
				.mockResolvedValue(true);

			installationForGhes = await Installation.create({
				gitHubInstallationId: installationIdForGhes,
				jiraHost,
				encryptedSharedSecret: "secret",
				clientKey: "client-key"
			});

			gitHubServerApp = await GitHubServerApp.create({
				uuid: "329f2718-76c0-4ef8-83c6-66d7f1767e0d",
				appId: 12321,
				gitHubBaseUrl: gheUrl,
				gitHubClientId: "client-id",
				gitHubClientSecret: "client-secret",
				webhookSecret: "webhook-secret",
				privateKey: fs.readFileSync(path.resolve(__dirname, "../../test/setup/test-key.pem"), { encoding: "utf8" }),
				gitHubAppName: "app-name",
				installationId: installationForGhes.id
			});

			subscriptionForGhe = await Subscription.create({
				gitHubInstallationId: installationIdForGhes,
				jiraHost,
				syncStatus: "ACTIVE",
				repositoryStatus: "complete",
				gitHubAppId: gitHubServerApp.id
			});

			await RepoSyncState.create({
				subscriptionId: subscriptionForGhe.id,
				repoId: 1,
				repoName: "test-repo-name",
				repoOwner: "integrations",
				repoFullName: "test-repo-name",
				repoUrl: "test-repo-url",
				repoPushedAt: new Date(),
				repoUpdatedAt: new Date(),
				repoCreatedAt: new Date(),
				branchStatus: "complete",
				commitStatus: "pending", // We want the next process to be commits
				pullStatus: "complete",
				updatedAt: new Date(),
				createdAt: new Date()
			});

			gheUserTokenNock(installationIdForGhes);
		});

		const makeExpectedJiraResponse = (commits) => ({
			preventTransitions: true,
			repositories: [
				{
					commits,
					"id": transformRepositoryId(1, gheUrl),
					"name": "test-repo-name",
					"url": "test-repo-url",
					"updateSequenceId": 12345678
				}
			],
			properties: {
				"installationId": 12345
			}
		});

		const createJiraNock = (commits) => {
			jiraNock
				.post("/rest/devinfo/0.10/bulk", makeExpectedJiraResponse(commits))
				.reply(200);
		};

		it("should sync to Jira when Commit Nodes have jira references", async () => {

			const data: BackfillMessagePayload = {
				installationId: installationIdForGhes,
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
			createJiraNock(commits);

			await expect(processInstallation()(data, sentry, getLogger("test"))).toResolve();
		});

	});
});
