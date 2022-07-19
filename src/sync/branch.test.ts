/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { branchesNoLastCursor } from "fixtures/api/graphql/branch-queries";
import { mocked } from "ts-jest/utils";
import { Installation } from "models/installation";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { Application } from "probot";
import { createWebhookApp } from "test/utils/probot";
import { processInstallation } from "./installation";
import { getLogger } from "config/logger";
import { cleanAll } from "nock";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/backfill";
import { sqsQueues } from "../sqs/queues";

import branchNodesFixture from "fixtures/api/graphql/branch-ref-nodes.json";

import branchCommitsHaveKeys from "fixtures/api/graphql/branch-commits-have-keys.json";

import associatedPRhasKeys from "fixtures/api/graphql/branch-associated-pr-has-keys.json";

import branchNoIssueKeys from "fixtures/api/graphql/branch-no-issue-keys.json";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { when } from "jest-when";
import { numberFlag, NumberFlags, stringFlag, StringFlags } from "config/feature-flags";

jest.mock("../sqs/queues");
jest.mock("config/feature-flags");

describe("sync/branches", () => {
	const installationId = 1234;

	let app: Application;
	const sentry: Hub = { setUser: jest.fn() } as any;

	const makeExpectedResponse = (branchName) => ({
		preventTransitions: true,
		repositories: [
			{
				branches: [
					{
						createPullRequestUrl: `test-repo-url/compare/${branchName}?title=TES-123-${branchName}&quick_pull=1`,
						id: branchName,
						issueKeys: ["TES-123"]
							.concat(jiraIssueKeyParser(branchName))
							.reverse()
							.filter((key) => !!key),
						lastCommit: {
							author: {
								avatar: "https://camo.githubusercontent.com/test-avatar",
								email: "test-author-email@example.com",
								name: "test-author-name"
							},
							authorTimestamp: "test-authored-date",
							displayId: "test-o",
							fileCount: 0,
							hash: "test-oid",
							id: "test-oid",
							issueKeys: ["TES-123"],
							message: "TES-123 test-commit-message",
							url: "test-repo-url/commit/test-sha",
							updateSequenceId: 12345678
						},
						name: branchName,
						url: `test-repo-url/tree/${branchName}`,
						updateSequenceId: 12345678
					}
				],
				commits: [
					{
						author: {
							avatar: "https://camo.githubusercontent.com/test-avatar",
							email: "test-author-email@example.com",
							name: "test-author-name"
						},
						authorTimestamp: "test-authored-date",
						displayId: "test-o",
						fileCount: 0,
						hash: "test-oid",
						id: "test-oid",
						issueKeys: ["TES-123"],
						message: "TES-123 test-commit-message",
						timestamp: "test-authored-date",
						url: "test-repo-url/commit/test-sha",
						updateSequenceId: 12345678
					}
				],
				id: "1",
				name: "test-repo-name",
				url: "test-repo-url",
				updateSequenceId: 12345678
			}
		],
		properties: {
			installationId: installationId
		}
	});

	const nockGitHubGraphQlRateLimit = (rateLimitReset: string) => {
		githubNock
			.post("/graphql", branchesNoLastCursor())
			.query(true)
			.reply(200, {
				"errors": [
					{
						"type": "RATE_LIMITED",
						"message": "API rate limit exceeded for user ID 42425541."
					}
				]
			}, {
				"X-RateLimit-Reset": rateLimitReset,
				"X-RateLimit-Remaining": "10"
			});
	};

	const nockBranchRequest = (response, variables?: Record<string, any>) =>
		githubNock
			.post("/graphql", branchesNoLastCursor(variables))
			.query(true)
			.reply(200, response);

	const mockBackfillQueueSendMessage = mocked(sqsQueues.backfill.sendMessage);

	beforeEach(async () => {
		mockSystemTime(12345678);

		await Installation.create({
			gitHubInstallationId: installationId,
			jiraHost,
			sharedSecret: "secret",
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
			branchStatus: "pending",
			commitStatus: "complete",
			pullStatus: "complete",
			updatedAt: new Date(),
			createdAt: new Date()
		});

		mocked(sqsQueues.backfill.sendMessage).mockResolvedValue(Promise.resolve());

		when(stringFlag).calledWith(
			StringFlags.TARGET_BACKFILL_TASKS,
			expect.anything(),
			expect.anything()
		).mockResolvedValue("*");

		app = await createWebhookApp();

		githubUserTokenNock(installationId);

	});

	const verifyMessageSent = (data: BackfillMessagePayload, delaySec ?: number) => {
		expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
		expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(data);
		expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(delaySec || 0);
	};

	it("should sync to Jira when branch refs have jira references", async () => {
		const data: BackfillMessagePayload = { installationId, jiraHost };
		nockBranchRequest(branchNodesFixture);

		jiraNock
			.post(
				"/rest/devinfo/0.10/bulk",
				makeExpectedResponse("branch-with-issue-key-in-the-last-commit")
			)
			.reply(200);

		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		verifyMessageSent(data);
	});

	it("should send data if issue keys are only present in commits", async () => {
		const data = { installationId, jiraHost };
		nockBranchRequest(branchCommitsHaveKeys);

		jiraNock
			.post(
				"/rest/devinfo/0.10/bulk",
				makeExpectedResponse("dev")
			)
			.reply(200);

		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		verifyMessageSent(data);
	});

	it("should send data if issue keys are only present in an associated PR title", async () => {
		const data = { installationId, jiraHost };
		nockBranchRequest(associatedPRhasKeys);

		jiraNock
			.post("/rest/devinfo/0.10/bulk", {
				preventTransitions: true,
				repositories: [
					{
						branches: [
							{
								createPullRequestUrl: "test-repo-url/compare/dev?title=PULL-123-dev&quick_pull=1",
								id: "dev",
								issueKeys: ["PULL-123"],
								lastCommit: {
									author: {
										avatar: "https://camo.githubusercontent.com/test-avatar",
										email: "test-author-email@example.com",
										name: "test-author-name"
									},
									authorTimestamp: "test-authored-date",
									displayId: "test-o",
									fileCount: 0,
									hash: "test-oid",
									issueKeys: [],
									id: "test-oid",
									message: "test-commit-message",
									url: "test-repo-url/commit/test-sha",
									updateSequenceId: 12345678
								},
								name: "dev",
								url: "test-repo-url/tree/dev",
								updateSequenceId: 12345678
							}
						],
						commits: [],
						id: "1",
						name: "test-repo-name",
						url: "test-repo-url",
						updateSequenceId: 12345678
					}
				],
				properties: {
					installationId: installationId
				}
			})
			.reply(200);

		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		verifyMessageSent(data);
	});

	it("should not call Jira if no issue keys are found", async () => {
		const data = { installationId, jiraHost };
		nockBranchRequest(branchNoIssueKeys);

		jiraNock.post(/.*/).reply(200);

		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		verifyMessageSent(data);
		expect(jiraNock).not.toBeDone();
		cleanAll();
	});

	it("should reschedule message with delay if there is rate limit", async () => {
		const data = { installationId, jiraHost };
		nockGitHubGraphQlRateLimit("12360");
		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		verifyMessageSent(data, 15);
	});


	describe("SYNC_BRANCH_COMMIT_TIME_LIMIT FF is enabled", () => {
		let dateCutoff: Date;
		beforeEach(() => {
			const time = Date.now();
			const cutoff = 1000 * 60 * 60 * 24;
			mockSystemTime(time);
			dateCutoff = new Date(time - cutoff);

			when(numberFlag).calledWith(
				NumberFlags.SYNC_BRANCH_COMMIT_TIME_LIMIT,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(cutoff);
		});

		it("should sync to Jira when branch refs have jira references", async () => {
			const data: BackfillMessagePayload = { installationId, jiraHost };
			nockBranchRequest(branchNodesFixture, { commitSince: dateCutoff.toISOString() });

			jiraNock
				.post(
					"/rest/devinfo/0.10/bulk",
					makeExpectedResponse("branch-with-issue-key-in-the-last-commit")
				)
				.reply(200);

			await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
			verifyMessageSent(data);
		});

		describe("Branch commit history value is passed", () => {
			beforeEach(() => {
				const time = Date.now();
				const cutoff = 1000 * 60 * 60 * 24;
				mockSystemTime(time);
				dateCutoff = new Date(time - cutoff);
			});
			it("should use commit history depth parameter before feature flag time", async () => {
				const time = Date.now();
				const commitHistoryDepthCutoff = 1000 * 60 * 60 * 96;
				mockSystemTime(time);
				const commitHistoryDepth = new Date(time - commitHistoryDepthCutoff);
				const data: BackfillMessagePayload = { installationId, jiraHost, commitHistoryDepth: commitHistoryDepthCutoff };

				nockBranchRequest(branchNodesFixture, { commitSince: commitHistoryDepth.toISOString() });
				jiraNock
					.post(
						"/rest/devinfo/0.10/bulk",
						makeExpectedResponse("branch-with-issue-key-in-the-last-commit")
					)
					.reply(200);

				await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
				verifyMessageSent(data);
			});
		});
	});
});
