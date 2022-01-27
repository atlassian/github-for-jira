/* eslint-disable @typescript-eslint/no-var-requires */
jest.mock("../../src/config/feature-flags");

import { Installation, Subscription } from "../../src/models";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../../src/config/feature-flags";
import { Application } from "probot";
import { createWebhookApp } from "../utils/probot";
import { sqsQueues } from "../../src/sqs/queues";
import waitUntil from "../utils/waitUntil";

describe.skip("Branch Webhook", () => {
	let app: Application;
	const gitHubInstallationId = 1234;

	beforeEach(async () => {
		app = await createWebhookApp();
		const clientKey = "client-key";
		await Installation.create({
			clientKey,
			sharedSecret: "shared-secret",
			jiraHost
		});
		await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: clientKey
		});
	});

	describe("Create Branch", () => {
		describe("USE_SQS_FOR_BRANCH enabled", () => {
			beforeEach(async () => {
				when(booleanFlag).calledWith(
					BooleanFlags.USE_SQS_FOR_BRANCH,
					expect.anything(),
					expect.anything()
				).mockResolvedValue(true);

				sqsQueues.branch.start();
			});

			afterEach(async () => {
				await sqsQueues.branch.stop();
			});

			it("should queue and process a create webhook", async () => {
				const fixture = require("../fixtures/branch-basic.json");

				const ref = encodeURIComponent("heads/TES-123-test-ref");
				const sha = "test-branch-ref-sha";

				// githubAccessTokenNock(gitHubInstallationId);
				githubNock.get(`/repos/test-repo-owner/test-repo-name/git/ref/${ref}`)
					.reply(200, {
						ref: `refs/${ref}`,
						object: {
							sha
						}
					});
				githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/${sha}`)
					.reply(200, {
						commit: {
							author: {
								name: "test-branch-author-name",
								email: "test-branch-author-name@github.com",
								date: "test-branch-author-date"
							},
							message: "test-commit-message"
						},
						html_url: `test-repo-url/commits/${sha}`
					});

				jiraNock.post("/rest/devinfo/0.10/bulk", {
					preventTransitions: false,
					repositories: [
						{
							name: "example/test-repo-name",
							url: "test-repo-url",
							id: "test-repo-id",
							branches: [
								{
									createPullRequestUrl: "test-repo-url/pull/new/TES-123-test-ref",
									lastCommit: {
										author: {
											name: "test-branch-author-name",
											email: "test-branch-author-name@github.com"
										},
										authorTimestamp: "test-branch-author-date",
										displayId: "test-b",
										fileCount: 0,
										hash: "test-branch-ref-sha",
										id: "test-branch-ref-sha",
										issueKeys: ["TES-123"],
										message: "test-commit-message",
										updateSequenceId: 12345678,
										url: "test-repo-url/commits/test-branch-ref-sha"
									},
									id: "TES-123-test-ref",
									issueKeys: ["TES-123"],
									name: "TES-123-test-ref",
									url: "test-repo-url/tree/TES-123-test-ref",
									updateSequenceId: 12345678
								}
							],
							updateSequenceId: 12345678
						}
					],
					properties: {
						installationId: gitHubInstallationId
					}
				}).reply(200);

				mockSystemTime(12345678);

				await expect(app.receive(fixture)).toResolve();

				await waitUntil(async () => {
					expect(githubNock).toBeDone();
					expect(jiraNock).toBeDone();
				});
			});

			it("should not update Jira issue if there are no issue Keys in the branch name", async () => {
				const fixture = require("../fixtures/branch-no-issues.json");
				// TODO: need to make sure it doesn't call jira API
				await expect(app.receive(fixture)).toResolve();

				await waitUntil(async () => {
					expect(githubNock).toBeDone();
					expect(jiraNock).toBeDone();
				});
			});

			it("should exit early if ref_type is not a branch", async () => {
				const fixture = require("../fixtures/branch-invalid-ref_type.json");
				// TODO: add check to see it exits when it should
				await expect(app.receive(fixture)).toResolve();

				await waitUntil(async () => {
					expect(githubNock).toBeDone();
					expect(jiraNock).toBeDone();
				});
			});
		});

		describe("USE_SQS_FOR_BRANCH disabled", () => {
			beforeEach(() => {
				when(booleanFlag).calledWith(
					BooleanFlags.USE_SQS_FOR_BRANCH,
					expect.anything(),
					expect.anything()
				).mockResolvedValue(false);
			});

			it("should update Jira issue with link to a branch on GitHub", async () => {
				const fixture = require("../fixtures/branch-basic.json");
				const ref = encodeURIComponent("heads/TES-123-test-ref");
				const sha = "test-branch-ref-sha";

				githubNock.get(`/repos/test-repo-owner/test-repo-name/git/ref/${ref}`)
					.reply(200, {
						ref: `refs/${ref}`,
						object: {
							sha
						}
					});
				githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/${sha}`)
					.reply(200, {
						commit: {
							author: {
								name: "test-branch-author-name",
								email: "test-branch-author-name@github.com",
								date: "test-branch-author-date"
							},
							message: "test-commit-message"
						},
						html_url: `test-repo-url/commits/${sha}`
					});

				jiraNock.post("/rest/devinfo/0.10/bulk", {
					preventTransitions: false,
					repositories: [
						{
							name: "example/test-repo-name",
							url: "test-repo-url",
							id: "test-repo-id",
							branches: [
								{
									createPullRequestUrl: "test-repo-url/pull/new/TES-123-test-ref",
									lastCommit: {
										author: {
											name: "test-branch-author-name",
											email: "test-branch-author-name@github.com"
										},
										authorTimestamp: "test-branch-author-date",
										displayId: "test-b",
										fileCount: 0,
										hash: "test-branch-ref-sha",
										id: "test-branch-ref-sha",
										issueKeys: ["TES-123"],
										message: "test-commit-message",
										updateSequenceId: 12345678,
										url: "test-repo-url/commits/test-branch-ref-sha"
									},
									id: "TES-123-test-ref",
									issueKeys: ["TES-123"],
									name: "TES-123-test-ref",
									url: "test-repo-url/tree/TES-123-test-ref",
									updateSequenceId: 12345678
								}
							],
							updateSequenceId: 12345678
						}
					],
					properties: {
						installationId: gitHubInstallationId
					}
				}).reply(200);

				mockSystemTime(12345678);
				const promise = app.receive(fixture);
				jest.runOnlyPendingTimers();
				await expect(promise).toResolve();
			});

			it("should not update Jira issue if there are no issue Keys in the branch name", async () => {
				const fixture = require("../fixtures/branch-no-issues.json");
				// TODO: add way to make sure jira API not hit
				await expect(app.receive(fixture)).toResolve();
			});

			it("should exit early if ref_type is not a branch", async () => {
				const fixture = require("../fixtures/branch-invalid-ref_type.json");
				// TODO: add check to see it exits when it should
				await expect(app.receive(fixture)).toResolve();
			});
		});
	});

	describe("delete a branch", () => {
		it("should call the devinfo delete API when a branch is deleted", async () => {
			const fixture = require("../fixtures/branch-delete.json");
			jiraNock
				.delete("/rest/devinfo/0.10/repository/test-repo-id/branch/TES-123-test-ref?_updateSequenceId=12345678")
				.reply(200);

			mockSystemTime(12345678);
			const promise = app.receive(fixture);
			jest.runOnlyPendingTimers();
			await expect(promise).toResolve();
		});
	});
});
