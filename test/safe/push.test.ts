/* eslint-disable @typescript-eslint/no-var-requires */
import nock from "nock";
import { createJobData, processPushJob } from "../../src/transforms/push";
import { createWebhookApp } from "../utils/probot";
import {getLogger} from "../../src/config/logger";
import {mocked} from "ts-jest/utils";
import {Installation, Subscription} from "../../src/models";
import {booleanFlag, BooleanFlags} from "../../src/config/feature-flags";
import {when} from "jest-when";
import waitUntil from "../utils/waitUntil";
import {start, stop} from "../../src/worker"

jest.mock("../../src/models");
jest.mock("../../src/config/feature-flags");

describe("GitHub Push", () => {
	let app;
	const mockGithubAccessToken = () => {
		githubNock
			.post("/app/installations/1234/access_tokens")
			.reply(200, {
				token: "token",
				expires_at: new Date().getTime()
			});
	}

	beforeEach(async () => {

		mocked(Subscription.getAllForInstallation).mockResolvedValue([
			{
				jiraHost: process.env.ATLASSIAN_URL,
				gitHubInstallationId: 1234,
				enabled: true
			}] as any);
		mocked(Subscription.getSingleInstallation).mockResolvedValue(
			{
				id: 1,
				jiraHost: process.env.ATLASSIAN_URL
			} as any);
		mocked(Installation.getForHost).mockResolvedValue(
			{
				jiraHost: process.env.ATLASSIAN_URL,
				sharedSecret: process.env.ATLASSIAN_SECRET,
				enabled: true
			} as any
		);

		app = await createWebhookApp();
	});

	afterEach(() => {

		if (!nock.isDone()) {
			// eslint-disable-next-line jest/no-jasmine-globals
			fail("nock is not done yet");
		}
		nock.cleanAll();
		jest.restoreAllMocks();
	});

	const getAtlassianUrl = () => process.env.ATLASSIAN_URL || "";
	const createJob = (payload, jiraHost:string) => ({data: createJobData(payload, jiraHost)} as any);

	//TODO
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
					jiraHost: getAtlassianUrl(),
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
		beforeEach(() => {
			Date.now = jest.fn(() => 12345678);
		});

		afterEach(() => {
			// eslint-disable-next-line jest/no-standalone-expect
			expect(githubNock.pendingMocks()).toEqual([]);
			// eslint-disable-next-line jest/no-standalone-expect
			expect(jiraNock.pendingMocks()).toEqual([]);
		})

		it("should update the Jira issue when no username is present", async () => {
			const event = require("../fixtures/push-no-username.json");
			const job = createJob(event.payload, getAtlassianUrl());

			mockGithubAccessToken();

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
				properties: {
					installationId: 1234
				}
			}).reply(200);

			await expect(processPushJob(app)(job, getLogger('test'))).toResolve();
		});

		it("should only send 10 files if push contains more than 10 files changed", async () => {
			const event = require("../fixtures/push-multiple.json");
			const job = createJob(event.payload, getAtlassianUrl());

			mockGithubAccessToken();

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
									avatar: "https://github.com/users/undefined.png",
									name: "test-commit-name",
									email: "test-email@example.com",
									url: "https://github.com/users/undefined",
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

			await expect(processPushJob(app)(job, getLogger('test'))).toResolve();
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
			const interceptor = githubNock.get(/.*/);
			const scope = interceptor.reply(200);

			await expect(app.receive(fixture)).toResolve();
			expect(scope).not.toBeDone();
			nock.removeInterceptor(interceptor);
		});

		it("should add the MERGE_COMMIT flag when a merge commit is made", async () => {
			const event = require("../fixtures/push-no-username.json");
			const job = createJob(event.payload, getAtlassianUrl());

			mockGithubAccessToken();

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
									avatar: "https://github.com/users/undefined.png",
									name: "test-commit-name",
									email: "test-email@example.com",
									url: "https://github.com/users/undefined",
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

			await expect(processPushJob(app)(job, getLogger('test'))).toResolve();
		});

		it("should not add the MERGE_COMMIT flag when a commit is not a merge commit", async () => {
			const event = require("../fixtures/push-no-username.json");
			const job = createJob(event.payload, getAtlassianUrl());

			mockGithubAccessToken();

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
									url: "https://github.com/users/undefined",
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

			await expect(processPushJob(app)(job, getLogger('test'))).toResolve();
		});
	});

	describe("end 2 end tests with queue", () => {

		beforeEach(() => {
			Date.now = jest.fn(() => 12345678);
		})

		beforeAll(async () => {
			//Start worker node for queues processing
			await start();
		});

		afterAll(async () => {
			//Stop worker node
			await stop();
		})


		function createPushEventAndMockRestReqeustsForItsProcessing() {
			const event = require("../fixtures/push-no-username.json");

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
									url: "https://github.com/users/undefined",
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
				properties: {installationId: 1234}
			}).reply(200);
			return event;
		}

		/**
		 * Tests when we process pushes immediately without using the queue
		 */
		it("should send bulk update event to Jira when push webhook received and queue is not involved", async () => {

			when(booleanFlag).calledWith(
				BooleanFlags.PROCESS_PUSHES_IMMEDIATELY,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(true);

			const event = createPushEventAndMockRestReqeustsForItsProcessing();

			await app.receive(event);

			// eslint-disable-next-line jest/no-standalone-expect
			expect(githubNock.pendingMocks()).toEqual([]);
			// eslint-disable-next-line jest/no-standalone-expect
			expect(jiraNock.pendingMocks()).toEqual([]);
		});

		/**
		 * Tests webhook processing through redis
		 */
		it("should send bulk update event to Jira when push webhook received and sent through redis queue", async () => {

			when(booleanFlag).calledWith(
				BooleanFlags.PROCESS_PUSHES_IMMEDIATELY,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(false);

			mockGithubAccessToken();

			const event = createPushEventAndMockRestReqeustsForItsProcessing();
			await app.receive(event);

			await waitUntil( async () => {
				// eslint-disable-next-line jest/no-standalone-expect
				expect(githubNock.pendingMocks()).toEqual([]);
				// eslint-disable-next-line jest/no-standalone-expect
				expect(jiraNock.pendingMocks()).toEqual([]);
			})

		});

	});

});
