import nock, { cleanAll, removeInterceptor } from "nock";
import { createJobData } from "../transforms/push";
import { getLogger } from "config/logger";
import { waitUntil } from "test/utils/wait-until";
import { pushQueueMessageHandler } from "./push";
import { PushQueueMessagePayload, SQSMessageContext } from "./sqs.types";
import { Message } from "aws-sdk/clients/sqs";
import { sqsQueues } from "./queues";

import pushNonMergeCommit from "fixtures/push-non-merge-commit.json";
import pushNoUsername from "fixtures/push-no-username.json";
import commitNoUsername from "fixtures/api/commit-no-username.json";
import pushMultiple from "fixtures/push-multiple.json";
import moreThanTenFiles from "fixtures/more-than-10-files.json";
import invalidFilePaths from "fixtures/invalid-file-paths.json";
import longFilePaths from "fixtures/file-paths-too-long.json";
import pushNoIssues from "fixtures/push-no-issues.json";
import pushNoIssuekeyCommits from "fixtures/push-no-issuekey-commits.json";
import pushMergeCommit from "fixtures/push-merge-commit.json";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { GitHubServerApp } from "models/github-server-app";
import { createWebhookApp, WebhookApp } from "test/utils/create-webhook-app";

import { GitHubPushData } from "interfaces/github";

const updateInstallationId = (payload: GitHubPushData): GitHubPushData  => {
	payload.installation.id = DatabaseStateCreator.GITHUB_INSTALLATION_ID;
	return payload;
};

jest.mock("config/feature-flags");

const createJiraPayloadNoUsername = (transofmedRepoId: string) => {
	return {
		preventTransitions: false,
		operationType: "NORMAL",
		repositories: [
			{
				name: "example/test-repo-name",
				url: "test-repo-url",
				id: transofmedRepoId,
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
			installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID
		}
	};
};

describe("Push Webhook", () => {

	describe("cloud",  () => {
		const logger = getLogger("test");
		const createMessageProcessingContext = async (payload: GitHubPushData): Promise<SQSMessageContext<PushQueueMessagePayload>> => ({
			payload: await createJobData(updateInstallationId(payload), jiraHost, logger),
			log: logger,
			message: {} as Message,
			receiveCount: 1,
			lastAttempt: false
		});

		let app: WebhookApp;
		beforeEach(async () => {
			app = await createWebhookApp();
			await new DatabaseStateCreator()
				.create();

			mockSystemTime(12345678);
		});

		describe("process push payloads", () => {

			it("should update the Jira issue when no username is present", async () => {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
					.reply(200, commitNoUsername);

				jiraNock.post("/rest/devinfo/0.10/bulk", createJiraPayloadNoUsername("test-repo-id")).reply(200);
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				await expect(pushQueueMessageHandler(await createMessageProcessingContext(pushNoUsername.payload as any))).toResolve();
			});

			it("should throw an error when GitHub request fails", async () => {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
					.reply(403, {});

				await expect(async () => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					await pushQueueMessageHandler(await createMessageProcessingContext(pushNoUsername.payload as any));
				}).rejects.toThrow("Error executing Axios Request: Request failed with status code 403");
			});

			it("should only send 10 files if push contains more than 10 files changed", async () => {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.get("/repos/test-repo-owner/test-repo-name/commits/test-commit-id")
					.reply(200, moreThanTenFiles);

				jiraNock.post("/rest/devinfo/0.10/bulk", {
					preventTransitions: false,
					operationType: "NORMAL",
					repositories: [
						{
							name: "example/test-repo-name",
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
						installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID
					}
				}).reply(200);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				await expect(pushQueueMessageHandler(await createMessageProcessingContext(pushMultiple.payload as any))).toResolve();
			});

			it("should only files with valid file paths (not empty or undefined)", async () => {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.get("/repos/test-repo-owner/test-repo-name/commits/test-commit-id")
					.reply(200, invalidFilePaths);

				jiraNock.post("/rest/devinfo/0.10/bulk", {
					preventTransitions: false,
					operationType: "NORMAL",
					repositories: [
						{
							name: "example/test-repo-name",
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
									fileCount: 4,
									files: [
										{
											path: "test-modified",
											changeType: "MODIFIED",
											linesAdded: 10,
											linesRemoved: 2,
											url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified"
										},
										{
											path: "test-removal",
											changeType: "DELETED",
											linesAdded: 0,
											linesRemoved: 4,
											url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal"
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
						installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID
					}
				}).reply(200);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				await expect(pushQueueMessageHandler(await createMessageProcessingContext(pushMultiple.payload as any))).toResolve();
			});

			it("should truncate long file paths to 1024", async () => {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock
					.get("/repos/test-repo-owner/test-repo-name/commits/test-commit-id")
					.reply(200, longFilePaths);

				jiraNock.post("/rest/devinfo/0.10/bulk", {
					preventTransitions: false,
					operationType: "NORMAL",
					repositories: [
						{
							name: "example/test-repo-name",
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
									fileCount: 2,
									files: [
										{
											path: "test-modified-vpB4yY6U99yDZUoFAC8KuY9MyYXXeiYPa2Ue0vm0jcYnHQP77hqH860X2av9UyUohtW9trl9DFfTMuxlMaeiM6o4AhPOmotZyGIyjzyN4zEvmZjyglMTcJXQWZsvA0SSn9oazE7nq8qIApultxsf3nEqlTBqS8AACG5GFR9uTwk9x7CWybm4MK2a35VRGTXlyv4U5NQcXA63M0o4Ag1g1jmZonJHQ3QHQuTWnu1uRv9yvIR5Q3uQgOAFywlzN1z172cvwZsYx4ysPAdkkt0SEKIJ7E0ihjWz1nnHRnCwmUasvxbd3ywHRPEV6VJJCcLZDbRBPXBALKJSx7xu34QoCpMEKfxJsxGbL7HfiY7Lhej2pkEFcwgKXnlIQJrJl1VxMYD6LhbBwKCkfV66F6DmNQKFfdBcVtpWQ8O2u0v0DmRiN5kcIgTBzmK1EZ1sw7cDFcCnq3n1p72JR3I8WVOHqcS3ufIn7dsGdHOXRZu8Fz3gxPYLLlO9qNhoUsgWXbn0EDN7cQ8k8Ty7L5nDyDsLiZvAOARcHyNQFhxS5uUWoZs6sdv9Tf9VUVdIsovkZLTegOqTntqk1ugLsgqeFOrPBPNdBuAtkUb7gUthV1d9wQ9CmQGUZ5ueOViSP5dHYOMvbKtbL9CM757TXXeZV2c3BE46xAuL2hYkXBbS6HpBdJ943NTN2Brf61dmAiT9swvxJkyVUXK4VHw0P7l37JsGG8Kdug99V4TH14xa9QNcKJ3jCe7JSlEgYXcFtmcUoQkr2h3LiTYvbLok8sEyO2633gXSc1YpWvIcCdBrdBE41ZOikj6NRnOhMSPP9ZQ9Qs7y482V12ZFf3W3qav7TqXYPpODwo8C4yjB0kWQdcIfMxWmFG3oKfVaqOuLi2auMB7LX2AEPmeckzWeow890zGPVzuBJFp892zpJZXHlPytOgcFWPW7cvahgpGLECzYNMmI4P1LDrKTIfTUFtRNhdLCAo6kQKMJA73Rk29EHNkn0R8ZCwTOJf",
											changeType: "MODIFIED",
											linesAdded: 10,
											linesRemoved: 2,
											url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified"
										},
										{
											path: "test-removal-vpB4yY6U99yDZUoFAC8KuY9MyYXXeiYPa2Ue0vm0jcYnHQP77hqH860X2av9UyUohtW9trl9DFfTMuxlMaeiM6o4AhPOmotZyGIyjzyN4zEvmZjyglMTcJXQWZsvA0SSn9oazE7nq8qIApultxsf3nEqlTBqS8AACG5GFR9uTwk9x7CWybm4MK2a35VRGTXlyv4U5NQcXA63M0o4Ag1g1jmZonJHQ3QHQuTWnu1uRv9yvIR5Q3uQgOAFywlzN1z172cvwZsYx4ysPAdkkt0SEKIJ7E0ihjWz1nnHRnCwmUasvxbd3ywHRPEV6VJJCcLZDbRBPXBALKJSx7xu34QoCpMEKfxJsxGbL7HfiY7Lhej2pkEFcwgKXnlIQJrJl1VxMYD6LhbBwKCkfV66F6DmNQKFfdBcVtpWQ8O2u0v0DmRiN5kcIgTBzmK1EZ1sw7cDFcCnq3n1p72JR3I8WVOHqcS3ufIn7dsGdHOXRZu8Fz3gxPYLLlO9qNhoUsgWXbn0EDN7cQ8k8Ty7L5nDyDsLiZvAOARcHyNQFhxS5uUWoZs6sdv9Tf9VUVdIsovkZLTegOqTntqk1ugLsgqeFOrPBPNdBuAtkUb7gUthV1d9wQ9CmQGUZ5ueOViSP5dHYOMvbKtbL9CM757TXXeZV2c3BE46xAuL2hYkXBbS6HpBdJ943NTN2Brf61dmAiT9swvxJkyVUXK4VHw0P7l37JsGG8Kdug99V4TH14xa9QNcKJ3jCe7JSlEgYXcFtmcUoQkr2h3LiTYvbLok8sEyO2633gXSc1YpWvIcCdBrdBE41ZOikj6NRnOhMSPP9ZQ9Qs7y482V12ZFf3W3qav7TqXYPpODwo8C4yjB0kWQdcIfMxWmFG3oKfVaqOuLi2auMB7LX2AEPmeckzWeow890zGPVzuBJFp892zpJZXHlPytOgcFWPW7cvahgpGLECzYNMmI4P1LDrKTIfTUFtRNhdLCAo6kQKMJA73Rk29EHNkn0R8ZCwTOJfL",
											changeType: "DELETED",
											linesAdded: 0,
											linesRemoved: 4,
											url: "https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal"
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
						installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID
					}
				}).reply(200);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				await expect(pushQueueMessageHandler(await createMessageProcessingContext(pushMultiple.payload as any))).toResolve();
			});

			it("should not run a command without a Jira issue", async () => {
				const interceptor = jiraNock.post(/.*/);
				const scope = interceptor.reply(200);

				await expect(app.receive(pushNoIssues)).toResolve();
				expect(scope).not.toBeDone();
				removeInterceptor(interceptor);
			});

			it("should not send anything to Jira if there's", async () => {
				// match any post calls for jira and github
				jiraNock.post(/.*/).reply(200);
				githubNock.get(/.*/).reply(200);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				await expect(app.receive(pushNoIssuekeyCommits as any)).toResolve();
				// Since no issues keys are found, there should be no calls to github's or jira's API
				expect(nock).not.toBeDone();
				// Clean up all nock mocks
				cleanAll();
			});

			it("should add the MERGE_COMMIT flag when a merge commit is made", async () => {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
					.reply(200, pushMergeCommit);

				jiraNock.post("/rest/devinfo/0.10/bulk", {
					preventTransitions: false,
					operationType: "NORMAL",
					repositories: [
						{
							name: "example/test-repo-name",
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
					properties: { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID }
				}).reply(200);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				await expect(pushQueueMessageHandler(await createMessageProcessingContext(pushNoUsername.payload as any))).toResolve();
			});

			it("should not add the MERGE_COMMIT flag when a commit is not a merge commit", async () => {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				githubNock.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
					.reply(200, pushNonMergeCommit);

				// flag property should not be present
				jiraNock.post("/rest/devinfo/0.10/bulk", {
					preventTransitions: false,
					operationType: "NORMAL",
					repositories: [
						{
							name: "example/test-repo-name",
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
					properties: { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID }
				}).reply(200);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				await expect(pushQueueMessageHandler(await createMessageProcessingContext(pushNoUsername.payload as any))).toResolve();
			});
		});

		describe("end 2 end tests with queue", () => {
			beforeAll(async () => {
				await sqsQueues.push.purgeQueue();
			});

			beforeEach(() => {
				mockSystemTime(12345678);
				sqsQueues.push.start();
			});

			afterEach(async () => {
				await sqsQueues.push.stop();
				await sqsQueues.push.purgeQueue();
			});

			it("should send bulk update event to Jira when push webhook received through sqs queue", async () => {
				githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);

				githubNock
					.get(`/repos/test-repo-owner/test-repo-name/commits/commit-no-username`)
					.reply(200, pushNonMergeCommit);

				// flag property should not be present
				jiraNock.post("/rest/devinfo/0.10/bulk", {
					preventTransitions: false,
					operationType: "NORMAL",
					repositories: [
						{
							name: "example/test-repo-name",
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
					properties: { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID }
				}).reply(200);

				pushNoUsername.payload.installation.id = DatabaseStateCreator.GITHUB_INSTALLATION_ID;
				await expect(app.receive(pushNoUsername)).toResolve();

				await waitUntil(() => {
					expect(githubNock).toBeDone();
					expect(jiraNock).toBeDone();
					return Promise.resolve();
				});
			});
		});
	});

	describe("server", () => {

		let gitHubServerApp: GitHubServerApp;

		const createMessageProcessingContext = async (payload: GitHubPushData): Promise<SQSMessageContext<PushQueueMessagePayload>> => ({
			payload: await createJobData(updateInstallationId(payload), jiraHost, getLogger("test"), {
				gitHubAppId: gitHubServerApp.id,
				appId: gitHubServerApp.appId,
				clientId: gitHubServerApp.gitHubClientId,
				gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
				gitHubApiUrl: gitHubServerApp.gitHubBaseUrl + "/api",
				uuid: gitHubServerApp.uuid
			}),
			log: getLogger("test"),
			message: {} as Message,
			receiveCount: 1,
			lastAttempt: false
		});

		beforeEach(async () => {

			const builderOutput = await new DatabaseStateCreator()
				.forServer()
				.create();

			gitHubServerApp = builderOutput.gitHubServerApp!;

			mockSystemTime(12345678);
		});

		describe("process push payloads", () => {

			it("should update the Jira issue when no username is present", async () => {
				gheUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
				gheApiNock
					.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
					.reply(200, commitNoUsername);

				jiraNock.post("/rest/devinfo/0.10/bulk", createJiraPayloadNoUsername("6769746875626d79646f6d61696e636f6d-test-repo-id")).reply(200);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				await expect(pushQueueMessageHandler(await createMessageProcessingContext(pushNoUsername.payload as any))).toResolve();
			});

		});
	});

});
