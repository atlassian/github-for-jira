/* eslint-disable @typescript-eslint/no-explicit-any */
import nock from "nock";
import { createJobData } from "../transforms/push";
import { createWebhookApp } from "test/utils/probot";
import { getLogger } from "config/logger";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { Application } from "probot";
import { waitUntil } from "test/utils/wait-until";
import { pushQueueMessageHandler } from "../sqs/push";
import { PushQueueMessagePayload } from "../sqs/sqs.types";
import { Context } from "../sqs/sqs";
import { Message } from "aws-sdk/clients/sqs";
import { sqsQueues } from "../sqs/queues";

import pushNonMergeCommit from "fixtures/push-non-merge-commit.json";
import pushNoUsername from "fixtures/push-no-username.json";
import commitNoUsername from "fixtures/api/commit-no-username.json";
import pushMultiple from "fixtures/push-multiple.json";
import moreThanTenFiles from "fixtures/more-than-10-files.json";
import pushNoIssues from "fixtures/push-no-issues.json";
import pushNoIssuekeyCommits from "fixtures/push-no-issuekey-commits.json";
import pushMergeCommit from "fixtures/push-merge-commit.json";
import { shouldTagBackfillRequests } from "config/feature-flags";
import { mocked } from "ts-jest/utils";

const createMessageProcessingContext = (payload, jiraHost: string): Context<PushQueueMessagePayload> => ({
	payload: createJobData(payload, jiraHost, undefined),
	log: getLogger("test"),
	message: {} as Message,
	receiveCount: 1,
	lastAttempt: false
});

jest.mock("config/feature-flags");

describe("Push Webhook", () => {

	let app: Application;
	beforeEach(async () => {
		mocked(shouldTagBackfillRequests).mockResolvedValue(true);
		app = await createWebhookApp();
		const clientKey = "client-key";
		await Installation.create({
			clientKey,
			sharedSecret: "shared-secret",
			jiraHost
		});
		await Subscription.create({
			jiraHost,
			gitHubInstallationId: 1234,
			jiraClientKey: clientKey
		});
	});

	describe("process push payloads", () => {

		beforeEach(async () => {
			mockSystemTime(12345678);
			await Subscription.create({
				gitHubInstallationId: 1234,
				jiraHost,
				jiraClientKey: "myClientKey"
			});
		});

		it("should update the Jira issue when no username is present", async () => {
			githubUserTokenNock(1234);
			githubNock
				.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.reply(200, commitNoUsername);

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
				operationType: "NORMAL",
				repositories: [
					{
						name: "test-repo-name",
						url: "test-repo-url",
						id: "test-repo-id",
						commits: [
							{
								hash: "commit-no-username",
								message: "[TEST-123] Test commit.",
								author: {
									name: "test-commit-name",
									email: "test-email@example.com"
								},
								authorTimestamp: "test-commit-date",
								displayId: "commit",
								fileCount: 3,
								files: [
									{
										path: "test-modified",
										changeType: "MODIFIED",
										linesAdded: 10,
										linesRemoved: 2,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified"
									},
									{
										path: "test-added",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-removal",
										changeType: "DELETED",
										linesAdded: 0,
										linesRemoved: 4,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal"
									}
								],
								id: "commit-no-username",
								issueKeys: ["TEST-123"],
								url: "https://github.com/octokit/Hello-World/commit/commit-no-username",
								updateSequenceId: 12345678
							}
						],
						updateSequenceId: 12345678
					}
				],
				properties: {
					installationId: 1234
				}
			}).reply(200);

			await expect(pushQueueMessageHandler(createMessageProcessingContext(pushNoUsername.payload, jiraHost))).toResolve();
		});

		it("should only send 10 files if push contains more than 10 files changed", async () => {
			githubUserTokenNock(1234);
			githubNock
				.get("/repos/test-repo-owner/test-repo-name/commits/test-commit-id")
				.reply(200, moreThanTenFiles);

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
				operationType: "NORMAL",
				repositories: [
					{
						name: "test-repo-name",
						url: "test-repo-url",
						id: "test-repo-id",
						commits: [
							{
								hash: "test-commit-id",
								message: "TEST-123 TEST-246 #comment This is a comment",
								author: {
									email: "test-email@example.com",
									name: "test-commit-name"
								},
								displayId: "test-c",
								fileCount: 12,
								files: [
									{
										path: "test-modified",
										changeType: "MODIFIED",
										linesAdded: 10,
										linesRemoved: 2,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified"
									},
									{
										path: "test-added-1",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-added-2",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-added-3",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-added-4",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-added-5",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-added-6",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-added-7",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-added-8",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-added-9",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									}
								],
								id: "test-commit-id",
								issueKeys: ["TEST-123", "TEST-246"],
								updateSequenceId: 12345678
							}
						],
						updateSequenceId: 12345678
					}
				],
				properties: {
					installationId: 1234
				}
			}).reply(200);

			await expect(pushQueueMessageHandler(createMessageProcessingContext(pushMultiple.payload, jiraHost))).toResolve();
		});

		it("should not run a command without a Jira issue", async () => {
			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(app.receive(pushNoIssues as any)).toResolve();
			expect(scope).not.toBeDone();
			nock.removeInterceptor(interceptor);
		});

		it("should not send anything to Jira if there's", async () => {
			// match any post calls for jira and github
			jiraNock.post(/.*/).reply(200);
			githubNock.get(/.*/).reply(200);

			await expect(app.receive(pushNoIssuekeyCommits as any)).toResolve();
			// Since no issues keys are found, there should be no calls to github's or jira's API
			expect(nock).not.toBeDone();
			// Clean up all nock mocks
			nock.cleanAll();
		});

		it("should add the MERGE_COMMIT flag when a merge commit is made", async () => {
			githubUserTokenNock(1234);
			githubNock.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.reply(200, pushMergeCommit);

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
				operationType: "NORMAL",
				repositories: [
					{
						name: "test-repo-name",
						url: "test-repo-url",
						id: "test-repo-id",
						commits: [
							{
								hash: "commit-no-username",
								message: "[TEST-123] Test commit.",
								author: {
									email: "test-email@example.com",
									name: "test-commit-name"
								},
								authorTimestamp: "test-commit-date",
								displayId: "commit",
								fileCount: 3,
								files: [
									{
										path: "test-modified",
										changeType: "MODIFIED",
										linesAdded: 10,
										linesRemoved: 2,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified"
									},
									{
										path: "test-added",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-removal",
										changeType: "DELETED",
										linesAdded: 0,
										linesRemoved: 4,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal"
									}
								],
								id: "commit-no-username",
								issueKeys: ["TEST-123"],
								url: "https://github.com/octokit/Hello-World/commit/commit-no-username",
								updateSequenceId: 12345678,
								flags: ["MERGE_COMMIT"]
							}
						],
						updateSequenceId: 12345678
					}
				],
				properties: { installationId: 1234 }
			}).reply(200);

			await expect(pushQueueMessageHandler(createMessageProcessingContext(pushNoUsername.payload, jiraHost))).toResolve();
		});

		it("should not add the MERGE_COMMIT flag when a commit is not a merge commit", async () => {
			githubUserTokenNock(1234);
			githubNock.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.reply(200, pushNonMergeCommit);

			// flag property should not be present
			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
				operationType: "NORMAL",
				repositories: [
					{
						name: "test-repo-name",
						url: "test-repo-url",
						id: "test-repo-id",
						commits: [
							{
								hash: "commit-no-username",
								message: "[TEST-123] Test commit.",
								author: {
									email: "test-email@example.com",
									name: "test-commit-name"
								},
								authorTimestamp: "test-commit-date",
								displayId: "commit",
								fileCount: 3,
								files: [
									{
										path: "test-modified",
										changeType: "MODIFIED",
										linesAdded: 10,
										linesRemoved: 2,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified"
									},
									{
										path: "test-added",
										changeType: "ADDED",
										linesAdded: 4,
										linesRemoved: 0,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
									},
									{
										path: "test-removal",
										changeType: "DELETED",
										linesAdded: 0,
										linesRemoved: 4,
										url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal"
									}
								],
								id: "commit-no-username",
								issueKeys: ["TEST-123"],
								url: "https://github.com/octokit/Hello-World/commit/commit-no-username",
								updateSequenceId: 12345678
							}
						],
						updateSequenceId: 12345678
					}
				],
				properties: { installationId: 1234 }
			}).reply(200);

			await expect(pushQueueMessageHandler(createMessageProcessingContext(pushNoUsername.payload, jiraHost))).toResolve();
		});
	});

	describe("end 2 end tests with queue", () => {
		beforeAll(async () => {
			await sqsQueues.branch.purgeQueue();
		});

		beforeEach(async () => {
			mockSystemTime(12345678);
			await sqsQueues.push.start();
		});

		afterEach(async () => {
			await sqsQueues.push.stop();
			await sqsQueues.push.purgeQueue();
		});

		it("should send bulk update event to Jira when push webhook received through sqs queue", async () => {
			githubUserTokenNock(1234);

			githubNock
				.get(`/repos/test-repo-owner/test-repo-name/commits/commit-no-username`)
				.reply(200, pushNonMergeCommit);

			// flag property should not be present
			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
				operationType: "NORMAL",
				repositories: [
					{
						name: "test-repo-name",
						url: "test-repo-url",
						id: "test-repo-id",
						commits: [{
							hash: "commit-no-username",
							message: "[TEST-123] Test commit.",
							author: {
								name: "test-commit-name",
								email: "test-email@example.com"
							},
							authorTimestamp: "test-commit-date",
							displayId: "commit",
							fileCount: 3,
							files: [
								{
									path: "test-modified",
									changeType: "MODIFIED",
									linesAdded: 10,
									linesRemoved: 2,
									url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified"
								},
								{
									path: "test-added",
									changeType: "ADDED",
									linesAdded: 4,
									linesRemoved: 0,
									url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added"
								},
								{
									path: "test-removal",
									changeType: "DELETED",
									linesAdded: 0,
									linesRemoved: 4,
									url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal"
								}
							],
							id: "commit-no-username",
							issueKeys: ["TEST-123"],
							url: "https://github.com/octokit/Hello-World/commit/commit-no-username",
							updateSequenceId: 12345678
						}],
						updateSequenceId: 12345678
					}
				],
				properties: { installationId: 1234 }
			}).reply(200);

			await expect(app.receive(pushNoUsername as any)).toResolve();

			await waitUntil(async () => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
			});
		});
	});
});
