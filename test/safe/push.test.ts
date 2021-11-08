/* eslint-disable @typescript-eslint/no-var-requires */
import nock from "nock";
import { createJobData, processPushJob } from "../../src/transforms/push";
import { createWebhookApp } from "../utils/probot";
import { getLogger } from "../../src/config/logger";
import { Installation, Subscription } from "../../src/models";
import { Application } from "probot";
import { start, stop } from "../../src/worker/startup";
import { booleanFlag, BooleanFlags } from "../../src/config/feature-flags";
import { when } from "jest-when";

jest.mock("../../src/config/feature-flags");

const createJob = (payload, jiraHost: string) => ({ data: createJobData(payload, jiraHost) } as any);

describe("Push Webhook", () => {
	let app: Application;
	beforeEach(async () => {
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

	afterEach(async () => {
		await Installation.destroy({ truncate: true });
		await Subscription.destroy({ truncate: true });
	});

	// TODO: figure out how to tests with queue
	describe.skip("add to push queue", () => {
		beforeEach(() => {
			process.env.REDIS_URL = "redis://test";
		});

		it("should add push event to the queue if Jira issue keys are present", async () => {
			const event = require("../fixtures/push-basic.json");

			await expect(app.receive(event)).toResolve();

			// TODO: find a way to test queues
			const queues = [];
			expect(queues.push).toBeCalledWith(
				{
					repository: event.payload.repository,
					shas: [{ id: "test-commit-id", issueKeys: ["TEST-123"] }],
					jiraHost,
					installationId: event.payload.installation.id
				}, { removeOnFail: true, removeOnComplete: true }
			);
		});

		it("should not add push event to the queue if there are no Jira issue keys present", async () => {
			const event = require("../fixtures/push-no-issues.json");
			await app.receive(event);
		});

		it("should handle payloads where only some commits have issue keys", async () => {
			const event = require("../fixtures/push-mixed.json");
			await app.receive(event);
			// TODO: fix this queues.
			const queues = [];
			expect(queues.push).toBeCalledWith(
				{
					repository: event.payload.repository,
					shas: [
						{ id: "test-commit-id-1", issueKeys: ["TEST-123", "TEST-246"] },
						{ id: "test-commit-id-2", issueKeys: ["TEST-345"] }
					],
					jiraHost: "https://test-atlassian-instance.net",
					installationId: event.payload.installation.id
				}, { removeOnFail: true, removeOnComplete: true }
			);
		});
	});

	describe("process push payloads", () => {
		beforeEach(async () => {
			Date.now = jest.fn(() => 12345678);
			await Subscription.create({
				gitHubInstallationId: 1234,
				jiraHost,
				jiraClientKey: "myClientKey"
			});
		});

		afterEach(async () => {
			await Subscription.destroy({ truncate: true });
		});

		it("should update the Jira issue when no username is present", async () => {
			const event = require("../fixtures/push-no-username.json");
			const job = createJob(event.payload, jiraHost);

			githubNock
				.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.reply(200, require("../fixtures/api/commit-no-username.json"));

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
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

			await expect(processPushJob(app)(job, getLogger("test"))).toResolve();
		});

		it("should only send 10 files if push contains more than 10 files changed", async () => {
			const event = require("../fixtures/push-multiple.json");
			const job = createJob(event.payload, jiraHost);

			githubNock
				.get("/repos/test-repo-owner/test-repo-name/commits/test-commit-id")
				.reply(200, require("../fixtures/more-than-10-files.json"));

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
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

			await expect(processPushJob(app)(job, getLogger("test"))).toResolve();
		});

		it("should not run a command without a Jira issue", async () => {
			const fixture = require("../fixtures/push-no-issues.json");
			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(app.receive(fixture)).toResolve();
			expect(scope).not.toBeDone();
			nock.removeInterceptor(interceptor);
		});

		it("should not send anything to Jira if there's", async () => {
			const fixture = require("../fixtures/push-no-issuekey-commits.json");
			// match any post calls for jira and github
			jiraNock.post(/.*/).reply(200);
			githubNock.get(/.*/).reply(200);

			await expect(app.receive(fixture)).toResolve();
			// Since no issues keys are found, there should be no calls to github's or jira's API
			expect(nock).not.toBeDone();
			// Clean up all nock mocks
			nock.cleanAll();
		});

		it("should add the MERGE_COMMIT flag when a merge commit is made", async () => {
			const event = require("../fixtures/push-no-username.json");
			const job = createJob(event.payload, jiraHost);

			githubNock.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.reply(200, require("../fixtures/push-merge-commit.json"));

			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
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

			await expect(processPushJob(app)(job, getLogger("test"))).toResolve();
		});

		it("should not add the MERGE_COMMIT flag when a commit is not a merge commit", async () => {
			const event = require("../fixtures/push-no-username.json");
			const job = createJob(event.payload, jiraHost);

			githubNock.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.reply(200, require("../fixtures/push-non-merge-commit"));

			// flag property should not be present
			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
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

			await expect(processPushJob(app)(job, getLogger("test"))).toResolve();
		});
	});

	// TODO: need to fix this further
	describe.skip("end 2 end tests with queue", () => {
		let event;

		beforeEach(async () => {
			Date.now = jest.fn(() => 12345678);
			event = require("../fixtures/push-no-username.json");

			githubNock.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.reply(200, require("../fixtures/push-non-merge-commit"));

			// flag property should not be present
			jiraNock.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: false,
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
									avatar: "https://github.com/users/undefined.png",
									name: "test-commit-name",
									email: "test-email@example.com",
									url: "https://github.com/users/undefined"
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
		});

		beforeAll(async () => {

			//Start worker node for queues processing
			await start();
		});


		afterAll(async () => {
			//Stop worker node
			await stop();
		});

		it("should send bulk update event to Jira when push webhook received and queue is not involved", async () => {

			when(booleanFlag).calledWith(
				BooleanFlags.PROCESS_PUSHES_IMMEDIATELY,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(true);

			await expect(app.receive(event)).toResolve();
		});

		it("should send bulk update event to Jira when push webhook received and sent through redis queue", async () => {
			when(booleanFlag).calledWith(
				BooleanFlags.PROCESS_PUSHES_IMMEDIATELY,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(false);

			when(booleanFlag).calledWith(
				BooleanFlags.SEND_PUSH_TO_SQS,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(false);

			await expect(app.receive(event)).toResolve();
		});

		it("should send bulk update event to Jira when push webhook received and sent through sqs queue", async () => {

			when(booleanFlag).calledWith(
				BooleanFlags.PROCESS_PUSHES_IMMEDIATELY,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(false);

			when(booleanFlag).calledWith(
				BooleanFlags.SEND_PUSH_TO_SQS,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(true);

			await expect(app.receive(event)).toResolve();
		});
	});
});
