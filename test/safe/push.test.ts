/* eslint-disable @typescript-eslint/no-var-requires */
import nock from "nock";
import { createJobData, processPushJob } from "../../src/transforms/push";
import { createWebhookApp } from "../utils/probot";
import { getLogger } from "../../src/config/logger";
import SubscriptionClass from "../../src/models/subscription";
import { Subscription } from "../../src/models";

describe("GitHub Actions", () => {
	let app;
	beforeEach(async () => app = await createWebhookApp());

	const createJob = (payload, jiraHost: string) => ({ data: createJobData(payload, jiraHost) } as any);

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
		let sub: SubscriptionClass;

		beforeEach(async () => {
			Date.now = jest.fn(() => 12345678);
			sub = await Subscription.create({
				gitHubInstallationId: 1234,
				jiraHost,
				jiraClientKey: "myClientKey",
			});
		});

		afterEach(async () => {
			await sub.destroy();
		})

		it("should update the Jira issue when no username is present", async () => {
			const event = require("../fixtures/push-no-username.json");
			const job = createJob(event.payload, jiraHost);

			githubNock
				.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.reply(200, require("../fixtures/api/commit-no-username.json"));

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

		it("should support commits without smart commands", async () => {
			const fixture = require("../fixtures/push-empty.json");
			// match any post calls
			jiraNock.post(/.*/).reply(200);

			// match any post calls
			const interceptor = githubNock.get(/.*/);
			const scope = interceptor.reply(200);

			await expect(app.receive(fixture)).toResolve();
			expect(scope).not.toBeDone();
			nock.removeInterceptor(interceptor);
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
								author: { email: "test-email@example.com", name: "test-commit-name" },
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
								author: { email: "test-email@example.com", name: "test-commit-name" },
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
});
