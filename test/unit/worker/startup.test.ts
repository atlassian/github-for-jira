/* eslint-disable @typescript-eslint/no-var-requires */
import nock from "nock";
import {start, stop, shutdown} from "../../../src/worker/startup";
import {enqueuePush} from "../../../src/transforms/push";
import waitUntil from "../../utils/waitUntil";
import {mocked} from "ts-jest/utils";
import {Installation, Subscription} from "../../../src/models";
import delay from "../../utils/delay";
import {queues} from "../../../src/worker/queues";

jest.mock("../../../src/models");
jest.mock("../../../src/config/feature-flags");

describe("worker stop test", () => {

	const cleanupQueue = async () => {
		const jobs = await queues.installation.getJobs(["active", "delayed", "waiting", "paused"]);
		for (const job of jobs) {
			await job.remove();
		}
	}

	beforeEach(async () => {
		Date.now = jest.fn(() => 12345678);

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

		//Start worker node for queues processing
		await start();
	});


	afterEach(async () => {
		try {
			if (!nock.isDone()) {
				// eslint-disable-next-line jest/no-jasmine-globals
				fail("nock is not done yet");
			}
		} finally {
			nock.cleanAll();
			jest.restoreAllMocks();

			//Stop worker node
			await stop();
			cleanupQueue();
		}
	})

	afterAll(async () => {
		await shutdown();
	})

	async function enqueueTestPushEvent() {
		const event = require("../../fixtures/push-no-username.json");
		await enqueuePush(event.payload, process.env.ATLASSIAN_URL || "")
	}

	const mockGithubAccessToken = () => {
		githubNock
			.post("/app/installations/1234/access_tokens")
			.optionally()
			.reply(200, {
				token: "token",
				expires_at: new Date().getTime()
			});
	}

	function mockGitHubAndJiraResponsesForRequestProcessing() {

		mockGithubAccessToken();

		githubNock.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
			.reply(200, require("../../fixtures/push-non-merge-commit"));

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
	}

	it("should normally process push events sync after restart", async () => {

		mockGitHubAndJiraResponsesForRequestProcessing();

		await stop();

		await start();

		await enqueueTestPushEvent();

		await waitUntil( async () => {
			// eslint-disable-next-line jest/no-standalone-expect
			expect(githubNock.pendingMocks()).toEqual([]);
			// eslint-disable-next-line jest/no-standalone-expect
			expect(jiraNock.pendingMocks()).toEqual([]);
		})
	});

	it("should not process push events when stopped", async () => {

		mockGitHubAndJiraResponsesForRequestProcessing();

		//await stop();

		await enqueueTestPushEvent();

		delay(1000)

		//No calls to GitHub or Jira werwe made after some time since message was pushed
		expect(githubNock.pendingMocks()).toHaveLength(1);
		expect(jiraNock.pendingMocks()).toHaveLength(1);

		nock.cleanAll();

	});

});
