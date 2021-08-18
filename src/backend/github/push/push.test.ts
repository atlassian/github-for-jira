/* eslint-disable @typescript-eslint/no-var-requires */
import nock from "nock";
import { createJobData, processPush } from "../../transforms/push";
import { createWebhookApp } from "../../../../test-utils/probot";

describe.skip("GitHub Actions", () => {
	let app;
	beforeEach(async () => app = await createWebhookApp());

	describe("add to push queue", () => {
		beforeEach(() => {
			process.env.REDIS_URL = "redis://test";
		});

		it("should add push event to the queue if Jira issue keys are present", async () => {
			const event = require("../../../common/test-utils/fixtures/push-basic.json");

			await expect(app.receive(event)).toResolve();

			// TODO: find a way to test queues
			const queues = [];
			expect(queues.push).toBeCalledWith(
				{
					repository: event.payload.repository,
					shas: [{ id: "test-commit-id", issueKeys: ["TEST-123"] }],
					jiraHost: process.env.ATLASSIAN_URL,
					installationId: event.payload.installation.id
				}, { removeOnFail: true, removeOnComplete: true }
			);
		});

		it("should not add push event to the queue if there are no Jira issue keys present", async () => {
			const event = require("../../../common//test-utils/fixtures/push-no-issues.json");
			await app.receive(event);
		});

		it("should handle payloads where only some commits have issue keys", async () => {
			const event = require("../../../common/test-utils/fixtures/push-mixed.json");
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

		it("should update the Jira issue when no username is present", async () => {
			const event = require("../../../common/test-utils/fixtures/push-no-username.json");
			const job = {
				data: createJobData(event.payload, process.env.ATLASSIAN_URL)
			};

			githubNock
				.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.replyWithFile(200, "../../../../test-utils/fixtures/api/commit-no-username.json");

			githubNock
				.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.replyWithFile(200, "../../../../test-utils/fixtures/api/commit-no-username.json");

			await expect(processPush(app)(job)).toResolve();

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
		});

		it("should only send 10 files if push contains more than 10 files changed", async () => {
			const event = require("../../../common/test-utils/fixtures/push-multiple.json");
			const job = {
				data: createJobData(event.payload, process.env.ATLASSIAN_URL)
			};

			githubNock
				.get("/repos/test-repo-owner/test-repo-name/commits/test-commit-id")
				.replyWithFile(200, "../../../common/test-utils/fixtures/more-than-10-files.json");

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

			await expect(processPush(app)(job)).toResolve();
		});

		// Commenting these out for the moment. DevInfo API runs these
		// transitions automatially based on the commit message, but we may
		// use them elsewhere for manual transitions
		// it('should run a #comment command in the commit message', async () => {
		//   const fixture = require('../../../common/test-utils/fixtures/push-comment.json')

		//   await expect(app.receive(fixture)).toResolve()

		//   jiraNock.post('/rest/api/latest/issue/TEST-123/comment', {
		//     body: 'This is a comment'
		//   }))
		// })

		// it('should run a #time command in the commit message', async () => {
		//   const fixture = require('../../../common/test-utils/fixtures/push-worklog.json')

		//   await expect(app.receive(fixture)).toResolve()

		//   jiraNock.post('/rest/api/latest/issue/TEST-123/worklog', {
		//     timeSpentSeconds: td.matchers.isA(Number),
		//     comment: 'This is a worklog'
		//   }))
		// })

		// it('should run a transition command in the commit message', async () => {
		//   const fixture = require('../../../common/test-utils/fixtures/push-transition.json')

		//   td.when(jiraApi.get(`/rest/api/latest/issue/TEST-123/transitions`))
		//     .thenReturn({
		//       transitions: [
		//         {
		//           id: 'test-transition-id',
		//           name: 'Resolve'
		//         }
		//       ]
		//     })

		//   await expect(app.receive(fixture)).toResolve()

		//   jiraNock.post('/rest/api/latest/issue/TEST-123/transitions', {
		//     transition: {
		//       id: 'test-transition-id'
		//     }
		//   }))
		// })

		// it('should run a transition command in the commit message', async () => {
		//   const fixture = require('../../../common/test-utils/fixtures/push-transition-comment.json')

		//   td.when(jiraApi.get(`/rest/api/latest/issue/TEST-123/transitions`))
		//     .thenReturn({
		//       transitions: [
		//         {
		//           id: 'test-transition-id',
		//           name: 'Resolve'
		//         }
		//       ]
		//     })

		//   await expect(app.receive(fixture)).toResolve()

		//   jiraNock.post('/rest/api/latest/issue/TEST-123/transitions', {
		//     transition: {
		//       id: 'test-transition-id'
		//     }
		//   }))

		//   jiraNock.post('/rest/api/latest/issue/TEST-123/comment', {
		//     body: 'This is a transition'
		//   }))
		// })

		// it('should run commands on all issues in the commit message', async () => {
		//   const fixture = require('../../../common/test-utils/fixtures/push-multiple.json')

		//   await expect(app.receive(fixture)).toResolve()

		//   jiraNock.post('/rest/api/latest/issue/TEST-123/comment', {
		//     body: 'This is a comment'
		//   }))

		//   jiraNock.post('/rest/api/latest/issue/TEST-246/comment', {
		//     body: 'This is a comment'
		//   }))
		// })

		it("should not run a command without a Jira issue", async () => {
			const fixture = require("../../../common//test-utils/fixtures/push-no-issues.json");
			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(app.receive(fixture)).toResolve();
			expect(scope).not.toBeDone();
			nock.removeInterceptor(interceptor);
		});

		it("should support commits without smart commands", async () => {
			const fixture = require("../../../common/test-utils/fixtures/push-empty.json");
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
			const event = require("../../../common/te/common/test-utils/fixtures/push-no-username.json");
			const job = {
				data: createJobData(event.payload, process.env.ATLASSIAN_URL)
			};

			githubNock.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.replyWithFile(200, "../../../../test/fixtures/push-merge-commit.json");

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

			await expect(processPush(app)(job)).toResolve();
		});

		it("should not add the MERGE_COMMIT flag when a commit is not a merge commit", async () => {
			const event = require("../../../common/test-utils/fixtures/push-no-username.json");
			const job = {
				data: createJobData(event.payload, process.env.ATLASSIAN_URL)
			};

			githubNock.get("/repos/test-repo-owner/test-repo-name/commits/commit-no-username")
				.replyWithFile(200, "../../../common/test-utils/fixtures/push-non-merge-commit");

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

			await expect(processPush(app)(job)).toResolve();
		});
	});
});
