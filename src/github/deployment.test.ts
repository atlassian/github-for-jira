/* eslint-disable @typescript-eslint/no-explicit-any */
import { createWebhookApp } from "test/utils/probot";
import { Application } from "probot";
import { Installation, Subscription } from "models/models";
import waitUntil from "test/utils/wait-until";
import { sqsQueues } from "../sqs/queues";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

import deploymentStatusBasic from "fixtures/deployment_status-basic.json";

jest.mock("config/feature-flags");

describe.each([true, false])("Deployment Webhook", (useNewGithubClient) => {
	let app: Application;
	const gitHubInstallationId = 1234;

	beforeAll(async () => {
		await sqsQueues.deployment.purgeQueue();
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

		await sqsQueues.deployment.start();

		when(booleanFlag).calledWith(
			BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DEPLOYMENTS,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(useNewGithubClient);
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

			await expect(app.receive(deploymentStatusBasic as any)).toResolve();

			await waitUntil(async () => {
				expect(githubNock).toBeDone();
				expect(jiraNock).toBeDone();
			});
		});
	});
});
