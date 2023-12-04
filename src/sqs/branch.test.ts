import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { waitUntil } from "test/utils/wait-until";
import { sqsQueues } from "../sqs/queues";

import branchInvalidRef from "fixtures/branch-invalid-ref_type.json";
import branchBasic from "fixtures/branch-basic.json";
import branchNoIssues from "fixtures/branch-no-issues.json";
import branchDelete from "fixtures/branch-delete.json";
import { createWebhookApp, WebhookApp } from "test/utils/create-webhook-app";

describe("Branch Webhook", () => {
	let app: WebhookApp;
	const gitHubInstallationId = 1234;

	beforeAll(async () => {
		await sqsQueues.branch.purgeQueue();
	});

	beforeEach(async () => {
		app = await createWebhookApp();
		const clientKey = "client-key";
		await Installation.create({
			clientKey,
			encryptedSharedSecret: "shared-secret",
			jiraHost
		});
		await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: clientKey
		});
		sqsQueues.branch.start();
	});

	afterEach(async () => {
		await sqsQueues.branch.stop();
		await sqsQueues.branch.purgeQueue();
	});

	describe("Create Branch", () => {
		it("should queue and process a create webhook", async () => {
			const ref = encodeURIComponent("heads/TES-123-test-ref");
			const sha = "test-branch-ref-sha";

			githubUserTokenNock(gitHubInstallationId);
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
				operationType: "NORMAL",
				repositories: [
					{
						name: "example/test-repo-name",
						url: "test-repo-url",
						id: "test-repo-id",
						branches: [
							{
								createPullRequestUrl: "test-repo-url/compare/TES-123-test-ref?title=TES-123-test-ref&quick_pull=1",
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

			await expect(app.receive(branchBasic)).toResolve();

			await waitUntil(() => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
				return Promise.resolve();
			});
		});

		it("should not update Jira issue if there are no issue Keys in the branch name", async () => {
			const getLastCommit = jest.fn();

			await expect(app.receive(branchNoIssues)).toResolve();
			expect(getLastCommit).not.toBeCalled();

			await waitUntil(() => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
				return Promise.resolve();
			});
		});

		it("should exit early if ref_type is not a branch", async () => {
			const parseSmartCommit = jest.fn();

			await expect(app.receive(branchInvalidRef)).toResolve();
			expect(parseSmartCommit).not.toBeCalled();

			await waitUntil(() => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
				return Promise.resolve();
			});
		});
	});

	describe("delete a branch", () => {
		it("should call the devinfo delete API when a branch is deleted", async () => {
			jiraNock
				.delete("/rest/devinfo/0.10/repository/test-repo-id/branch/TES-123-test-ref")
				.query({
					_updateSequenceId: 12345678
				})
				.reply(200);

			mockSystemTime(12345678);

			await expect(app.receive(branchDelete)).toResolve();

			await waitUntil(() => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
				return Promise.resolve();
			});
		});
	});
});
