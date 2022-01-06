/* eslint-disable @typescript-eslint/no-var-requires */
import { createWebhookApp } from "../utils/probot";
import { Application } from "probot";
import { Installation, Subscription } from "../../src/models";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../../src/config/feature-flags";
import { start, stop } from "../../src/worker/startup";
import sqsQueues from "../../src/sqs/queues";
import waitUntil from "../utils/waitUntil";

jest.mock("../../src/config/feature-flags");

describe("Deployment Webhook", () => {
	let app: Application;
	const gitHubInstallationId = 1234;

	beforeAll(async () => {
		//Start worker node for queues processing
		await start();
	});

	afterAll(async () => {
		//Stop worker node
		await stop();
		await sqsQueues.deployment.waitUntilListenerStopped();
	});

	beforeEach(async () => {
		app = await createWebhookApp();

		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		await Installation.create({
			jiraHost,
			clientKey: "client-key",
			sharedSecret: "shared-secret"
		});

	});

	afterEach(async () => {
		await Installation.destroy({ truncate: true });
		await Subscription.destroy({ truncate: true });
	});

	describe("deployment_status", () => {

		it("should queue and process a deployment event", async () => {

			when(booleanFlag).calledWith(
				BooleanFlags.USE_SQS_FOR_DEPLOYMENT,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(true);

			const fixture = require("../fixtures/deployment_status-basic.json");
			const sha = fixture.payload.deployment.sha;

			githubNock.post(`/app/installations/1234/access_tokens`)
				.reply(200, {
					expires_at: Date.now() + 3600,
					permissions: {},
					repositories: {},
					token: "token"
				})

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

			jiraNock.post("/rest/deployments/0.1/bulk", {
				deployments:
					[
						{
							schemaVersion: "1.0",
							deploymentSequenceNumber: 1234,
							updateSequenceNumber: 123456,
							issueKeys:
								[
									"TEST-123"
								],
							displayName: "deploy",
							url: "test-repo-url/commit/885bee1-commit-id-1c458/checks",
							description: "deploy",
							lastUpdated: "2021-06-28T12:15:18.000Z",
							state: "successful",
							pipeline:
								{
									id: "deploy",
									displayName: "deploy",
									url: "test-repo-url/commit/885bee1-commit-id-1c458/checks"
								},
							environment:
								{
									id: "Production",
									displayName: "Production",
									type: "production"
								}
						}
					],
				properties:
					{
						gitHubInstallationId: 1234
					}
			}).reply(200);

			await expect(app.receive(fixture)).toResolve();

			await waitUntil(async () => {
				// eslint-disable-next-line jest/no-standalone-expect
				expect(githubNock.pendingMocks()).toEqual([]);
				// eslint-disable-next-line jest/no-standalone-expect
				expect(jiraNock.pendingMocks()).toEqual([]);
			});
		});

		it("should update the Jira issue with the linked GitHub deployment without queue - delete with FF cleanup", async () => {

			// delete this whole test with FF cleanup
			when(booleanFlag).calledWith(
				BooleanFlags.USE_SQS_FOR_DEPLOYMENT,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(false);

			const fixture = require("../fixtures/deployment_status-basic.json");
			const sha = fixture.payload.deployment.sha;

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

			jiraNock.post("/rest/deployments/0.1/bulk", {
				deployments:
					[
						{
							schemaVersion: "1.0",
							deploymentSequenceNumber: 1234,
							updateSequenceNumber: 123456,
							issueKeys:
								[
									"TEST-123"
								],
							displayName: "deploy",
							url: "test-repo-url/commit/885bee1-commit-id-1c458/checks",
							description: "deploy",
							lastUpdated: "2021-06-28T12:15:18.000Z",
							state: "successful",
							pipeline:
								{
									id: "deploy",
									displayName: "deploy",
									url: "test-repo-url/commit/885bee1-commit-id-1c458/checks"
								},
							environment:
								{
									id: "Production",
									displayName: "Production",
									type: "production"
								}
						}
					],
				properties:
					{
						gitHubInstallationId: 1234
					}
			}).reply(200);

			Date.now = jest.fn(() => 12345678);

			await expect(app.receive(fixture)).toResolve();
		});
	});
});
