/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import issueKeyParser from "jira-issue-key-parser";
import {branchesNoLastCursor} from "../../fixtures/api/graphql/branch-queries";
import {mocked} from "ts-jest/utils";
import {Installation, RepoSyncState, Subscription} from "../../../src/models";
import {Application} from "probot";
import {createWebhookApp} from "../../utils/probot";
import {processInstallation} from "../../../src/sync/installation";
import nock from "nock";
import {getLogger} from "../../../src/config/logger";
import {Hub} from "@sentry/types/dist/hub";
import {BackfillMessagePayload} from "../../../src/sqs/backfill";
import sqsQueues from "../../../src/sqs/queues";
import {when} from "jest-when";
import {booleanFlag, BooleanFlags} from "../../../src/config/feature-flags";

jest.mock("../../../src/sqs/queues", () => {
	return {
		backfill: {sendMessage: jest.fn()}
	}
});

jest.mock("../../../src/config/feature-flags");

describe("sync/branches", () => {
	const installationId = 1234;

	let app: Application;
	const branchNodesFixture = require("../../fixtures/api/graphql/branch-ref-nodes.json");
	const branchCommitsHaveKeys = require("../../fixtures/api/graphql/branch-commits-have-keys.json");
	const associatedPRhasKeys = require("../../fixtures/api/graphql/branch-associated-pr-has-keys.json");
	const branchNoIssueKeys = require("../../fixtures/api/graphql/branch-no-issue-keys.json");

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	const sentry: Hub = { setUser: jest.fn() } as Hub;

	function makeExpectedResponse(branchName) {
		const issueKeys = issueKeyParser().parse(branchName) || [];

		return {
			preventTransitions: true,
			repositories: [
				{
					branches: [
						{
							createPullRequestUrl: `test-repo-url/pull/new/${branchName}`,
							id: branchName,
							issueKeys: ["TES-123"]
								.concat(issueKeys)
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
		};
	}

	function nockGitHubGraphQlRateLimit(rateLimitReset: string) {

		githubNock
			.post("/graphql", branchesNoLastCursor)
			.query(true)
			.reply(200, {
				"errors": [
					{
						"type": "RATE_LIMITED",
						"message": "API rate limit exceeded for user ID 42425541."
					}
				]
			}, 	{
				"X-RateLimit-Reset": rateLimitReset,
				"X-RateLimit-Remaining": "10"
			});
	}

	function nockBranchRequest(fixture) {

		githubNock
			.post("/graphql", branchesNoLastCursor)
			.query(true)
			.reply(200, fixture);
	}

	let mockBackfillQueueSendMessage;

	beforeEach(async () => {
		mockBackfillQueueSendMessage = sqsQueues.backfill.sendMessage as jest.Mock;
		mockBackfillQueueSendMessage.mockReset();

		Date.now = jest.fn(() => 12345678);

		await Installation.create({
			gitHubInstallationId: installationId,
			jiraHost,
			sharedSecret: "secret",
			clientKey: "client-key"
		});

		const subscription = await Subscription.create({gitHubInstallationId: installationId,
			jiraHost,
			syncStatus: "ACTIVE"
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

		app = await createWebhookApp();

		githubNock
			.post("/app/installations/1234/access_tokens")
			.optionally() // TODO: need to remove optionally and make it explicit
			.reply(200, {
				token: "token",
				expires_at: new Date().getTime() + 1_000_000
			});
	});



	afterEach(async () => {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		sqsQueues.backfill.sendMessage.mockReset();
		await Installation.destroy({ truncate: true });
		await Subscription.destroy({ truncate: true });
		await RepoSyncState.destroy({truncate: true});
	})

	const verifyMessageSent = (data: BackfillMessagePayload, delaySec ?: number) => {
		expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
		expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(data);
		expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(delaySec || 0);
	}

	const branchSyncTests = () => {
		it("should sync to Jira when branch refs have jira references", async () => {
			const data: BackfillMessagePayload = {installationId, jiraHost};
			nockBranchRequest(branchNodesFixture);

			jiraNock
				.post(
					"/rest/devinfo/0.10/bulk",
					makeExpectedResponse("TES-321-branch-name")
				)
				.reply(200);

			await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
			verifyMessageSent(data)
		});

		it("should send data if issue keys are only present in commits", async () => {
			const data = {installationId, jiraHost};
			nockBranchRequest(branchCommitsHaveKeys);

			jiraNock
				.post(
					"/rest/devinfo/0.10/bulk",
					makeExpectedResponse("dev")
				)
				.reply(200);

			await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
			verifyMessageSent(data)
		});

		it("should send data if issue keys are only present in an associatd PR title", async () => {
			const data = {installationId, jiraHost};
			nockBranchRequest(associatedPRhasKeys);

			jiraNock
				.post("/rest/devinfo/0.10/bulk", {
					preventTransitions: true,
					repositories: [
						{
							branches: [
								{
									createPullRequestUrl: "test-repo-url/pull/new/dev",
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
			verifyMessageSent(data)
		});

		it("should not call Jira if no issue keys are found", async () => {
			const data = {installationId, jiraHost};
			nockBranchRequest(branchNoIssueKeys);

			const interceptor = jiraNock.post(/.*/);
			const scope = interceptor.reply(200);

			await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
			verifyMessageSent(data)
			expect(scope).not.toBeDone();
			nock.removeInterceptor(interceptor);
		});

		it("should reschedule message with delay if there is rate limit", async () => {
			const data = {installationId, jiraHost};
			nockGitHubGraphQlRateLimit("12360");
			await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
			verifyMessageSent(data, 15)
		});
	}

	describe("New GH Client feature flag is OFF", () => {

		beforeEach(() => {
			when(booleanFlag).calledWith(
				BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_BRANCHES,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(false);
		})

		branchSyncTests();
	});

	describe("New GH Client feature flag is ON", () => {

		beforeEach(() => {
			when(booleanFlag).calledWith(
				BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_BRANCHES,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(true);
		})

		branchSyncTests();
	});

});
