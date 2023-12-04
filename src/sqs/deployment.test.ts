import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { waitUntil } from "test/utils/wait-until";
import { sqsQueues } from "../sqs/queues";
import { createWebhookApp, WebhookApp } from "test/utils/create-webhook-app";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";
import deploymentStatusBasic from "fixtures/deployment_status-basic.json";

jest.mock("config/feature-flags");

const mockGitHubRateLimit = (limit: number, remaining: number, resetTime: number) => {
	githubUserTokenNock(1234);
	githubNock.get(`/rate_limit`)
		.reply(200, {
			"resources": {
				"core": {
					"limit": limit,
					"remaining": remaining,
					"reset": resetTime
				},
				"graphql": {
					"limit": 5000,
					"remaining": 5000,
					"reset": resetTime
				}
			}
		});
};

const mockRatelimitThreshold = (threshold: number) => {
	when(numberFlag).calledWith(
		NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
		100,
		jiraHost
	).mockResolvedValue(threshold);
};

describe("Deployment Webhook", () => {
	let app: WebhookApp;
	const gitHubInstallationId = 1234;

	beforeAll(async () => {
		await sqsQueues.deployment.purgeQueue();
	});

	beforeEach(async () => {

		mockGitHubRateLimit(100, 90, 100000);
		mockRatelimitThreshold(100);

		app = await createWebhookApp();

		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		await Installation.create({
			jiraHost,
			clientKey: "client-key",
			encryptedSharedSecret: "shared-secret"
		});

		sqsQueues.deployment.start();
	});

	afterEach(async () => {
		await sqsQueues.deployment.stop();
		await sqsQueues.deployment.purgeQueue();
	});

	describe("deployment_status", () => {

		it("should queue and process a deployment event", async () => {
			const sha = deploymentStatusBasic.payload.deployment.sha;

			githubUserTokenNock(1234);

			githubNock.get(`/repos/test-repo-owner/test-repo-name/commits/${sha}`)
				.reply(200, {
					commit: {
						author: {
							name: "test-branch-author-name",
							email: "test-branch-author-name@github.com",
							date: "test-branch-author-date"
						},
						message: "[TEST-123] test-commit-message"
					},
					html_url: `test-repo-url/commits/${sha}`
				});

			githubNock.get(`/repos/test-repo-owner/test-repo-name/deployments`)
				.query(true)
				.reply(200, [
					{
						"id": 1,
						"sha": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
						"ref": "topic-branch",
						"task": "deploy",
						"payload": {},
						"original_environment": "staging",
						"environment": "production",
						"description": "Deploy request from hubot",
						"creator": {
							"login": "test-repo-owner",
							"id": 1,
							"type": "User"
						},
						"created_at": "2012-07-20T01:19:13Z",
						"updated_at": "2012-07-20T01:19:13Z",
						"statuses_url": "https://api.github.com/repos/octocat/example/deployments/1/statuses",
						"repository_url": "https://api.github.com/repos/octocat/example",
						"transient_environment": false,
						"production_environment": true
					}
				]);

			githubNock.get(`/repos/test-repo-owner/test-repo-name/compare/a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d...f95f852bd8fca8fcc58a9a2d6c842781e32a215e`)
				.reply(200, {
					"total_commits": 2,
					"commits": [
						{
							"sha": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
							"commit": {
								"message": "base commit"
							}
						},
						{
							"sha": "f95f852bd8fca8fcc58a9a2d6c842781e32a215e",
							"commit": {
								"message": "head commit"
							}
						}
					]
				});

			githubNock.get(`/repos/test-repo-owner/test-repo-name/deployments/1/statuses`)
				.query(true)
				.reply(200, [
					{
						"id": 1,
						"state": "success",
						"description": "Deployment finished successfully.",
						"environment": "production"
					}
				]);

			jiraNock.post("/rest/deployments/0.1/bulk", {
				deployments:
					[
						{
							"schemaVersion": "1.0",
							"deploymentSequenceNumber": 1234,
							"updateSequenceNumber": 123456,
							"displayName": "[TEST-123] test-commit-message",
							"url": "test-repo-url/commit/885bee1-commit-id-1c458/checks",
							"description": "deploy",
							"lastUpdated": "2021-06-28T12:15:18.000Z",
							"state": "successful",
							"pipeline": {
								"id": "deploy",
								"displayName": "deploy",
								"url": "test-repo-url/commit/885bee1-commit-id-1c458/checks"
							},
							"environment": {
								"id": "Production",
								"displayName": "Production",
								"type": "production"
							},
							"associations": [
								{
									"associationType": "issueIdOrKeys",
									"values": ["TEST-123"]
								},
								{
									"associationType": "commit",
									"values": [
										{
											"commitHash": "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
											"repositoryId": "65"
										},
										{
											"commitHash": "f95f852bd8fca8fcc58a9a2d6c842781e32a215e",
											"repositoryId": "65"
										}
									]
								}
							]
						}
					],
				properties:
					{
						gitHubInstallationId: 1234,
						repositoryId: 65
					},
				preventTransitions: false,
				operationType: "NORMAL"
			}).reply(200);

			await expect(app.receive(deploymentStatusBasic)).toResolve();

			await waitUntil(() => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
				return Promise.resolve();
			});
		});
	});
});
