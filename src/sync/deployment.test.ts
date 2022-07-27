/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { removeInterceptor } from "nock";
import { deploymentsNoLastCursor } from "fixtures/api/graphql/deployment-queries";
import { processInstallation } from "./installation";
import { Installation } from "models/installation";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { mocked } from "ts-jest/utils";
import { Application } from "probot";
import { createWebhookApp } from "test/utils/probot";
import { sqsQueues } from "../sqs/queues";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { BackfillMessagePayload } from "../sqs/backfill";

import deploymentNodesFixture from "fixtures/api/graphql/deployment-nodes.json";
import mixedDeploymentNodes from "fixtures/api/graphql/deployment-nodes-mixed.json";

jest.mock("../sqs/queues");
jest.mock("config/feature-flags");

describe("sync/deployments", () => {
	let app: Application;
	const installationId = 1234;
	const sentry: Hub = { setUser: jest.fn() } as any;
	const mockBackfillQueueSendMessage = mocked(sqsQueues.backfill.sendMessage);

	const makeExpectedJiraResponse = (deployments) => ({
		deployments,
		properties: {
			"gitHubInstallationId": 1234
		}
	});

	const getDeploymentsQuery = () => {
		return deploymentsNoLastCursor({
			owner: "integrations",
			repo: "test-repo-name",
			per_page: 20
		});
	};

	const createGitHubNock = (deploymentsResponse?) => {
		githubNock
			.post("/graphql", getDeploymentsQuery())
			.query(true)
			.reply(200, deploymentsResponse);
	};

	const createJiraNock = (deployments) => {
		jiraNock
			.post("/rest/deployments/0.1/bulk", makeExpectedJiraResponse(deployments))
			.reply(200);
	};

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
			branchStatus: "complete",
			commitStatus: "complete",
			pullStatus: "complete",
			deploymentStatus: "pending", // We want the next process to be deployment
			buildStatus: "complete",
			updatedAt: new Date(),
			createdAt: new Date()
		});

		app = await createWebhookApp();
		mocked(sqsQueues.backfill.sendMessage).mockResolvedValue(Promise.resolve());

		githubUserTokenNock(installationId);

	});

	const verifyMessageSent = (data: BackfillMessagePayload, delaySec ?: number) => {
		expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
		expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(data);
		expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(delaySec || 0);
	};

	it("should sync to Jira when Deployment messages have jira references", async () => {
		const data: BackfillMessagePayload = { installationId, jiraHost };

		githubUserTokenNock(installationId);

		createGitHubNock(deploymentNodesFixture);
		githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`)
			.reply(200, {
				commit: {
					author: {
						name: "test-branch-author-name",
						email: "test-branch-author-name@github.com",
						date: "test-branch-author-date"
					},
					message: "[TEST-123] test-commit-message"
				},
				html_url: `test-repo-url/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`
			});

		const deployments = [
			{
				schemaVersion: "1.0",
				deploymentSequenceNumber: 500226426,
				updateSequenceNumber: 500226426,
				issueKeys:
					[
						"TEST-123"
					],
				displayName: "deploy",
				url: "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks",
				description: "deploy",
				lastUpdated: "2022-02-03T22:45:04.000Z",
				state: "successful",
				pipeline:
					{
						id: "deploy",
						displayName: "deploy",
						url: "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks"
					},
				environment:
					{
						id: "prod",
						displayName: "prod",
						type: "production"
					}
			}
		];

		createJiraNock(deployments);

		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		verifyMessageSent(data);
	});

	it("should send Jira all deployments that have Issue Keys", async () => {
		const data = { installationId, jiraHost };

		githubUserTokenNock(installationId);

		createGitHubNock(mixedDeploymentNodes);

		githubUserTokenNock(installationId);
		githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`)
			.reply(200, {
				commit: {
					author: {
						name: "test-branch-author-name",
						email: "test-branch-author-name@github.com",
						date: "test-branch-author-date"
					},
					message: "[TEST-123] test-commit-message"
				},
				html_url: `test-repo-url/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`
			});

		githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`)
			.reply(200, {
				commit: {
					author: {
						name: "test-branch-author-name",
						email: "test-branch-author-name@github.com",
						date: "test-branch-author-date"
					},
					message: "[TEST-222] test-commit-message"
				},
				html_url: `test-repo-url/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`
			});

		const deployments = [
			{
				schemaVersion: "1.0",
				deploymentSequenceNumber: 500226426,
				updateSequenceNumber: 500226426,
				issueKeys:
					[
						"TEST-123"
					],
				displayName: "deploy",
				url: "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks",
				description: "deploy",
				lastUpdated: "2022-02-03T22:45:04.000Z",
				state: "successful",
				pipeline:
					{
						id: "deploy",
						displayName: "deploy",
						url: "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks"
					},
				environment:
					{
						id: "prod",
						displayName: "prod",
						type: "production"
					}
			},
			{
				schemaVersion: "1.0",
				deploymentSequenceNumber: 1234,
				updateSequenceNumber: 1234,
				issueKeys:
					[
						"TEST-222"
					],
				displayName: "deploy",
				url: "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks",
				description: "deploy",
				lastUpdated: "2022-02-03T22:45:04.000Z",
				state: "successful",
				pipeline:
					{
						id: "deploy",
						displayName: "deploy",
						url: "https://github.com/test-repo-owner/test-repo-name/commit/51e16759cdac67b0d2a94e0674c9603b75a840f6/checks"
					},
				environment:
					{
						id: "prod",
						displayName: "prod",
						type: "production"
					}
			}
		];
		createJiraNock(deployments);

		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		verifyMessageSent(data);
	});

	it("should not call Jira if no issue keys are present", async () => {
		const data: BackfillMessagePayload = { installationId, jiraHost };

		githubUserTokenNock(installationId);

		createGitHubNock(deploymentNodesFixture);
		githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`)
			.reply(200, {
				commit: {
					author: {
						name: "test-branch-author-name",
						email: "test-branch-author-name@github.com",
						date: "test-branch-author-date"
					},
					message: "NO SMART COMMITS HERE test-commit-message"
				},
				html_url: `test-repo-url/commits/51e16759cdac67b0d2a94e0674c9603b75a840f6`
			});

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		removeInterceptor(interceptor);
	});

	it("should not call Jira if no data is returned", async () => {
		const data = { installationId, jiraHost };
		createGitHubNock();

		const interceptor = jiraNock.post(/.*/);
		const scope = interceptor.reply(200);

		await expect(processInstallation(app)(data, sentry, getLogger("test"))).toResolve();
		expect(scope).not.toBeDone();
		removeInterceptor(interceptor);
	});

});
