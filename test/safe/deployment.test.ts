/* eslint-disable @typescript-eslint/no-var-requires */
import { createWebhookApp } from "../utils/probot";
import { Application } from "probot";
import { Installation, Subscription } from "../../src/models";

describe("Deployment Webhook", () => {
	let app: Application;
	const gitHubInstallationId = 1234;

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
		it("should update the Jira issue with the linked GitHub deployment", async () => {
			const fixture = require("../fixtures/deployment-basic.json");
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

			/*jiraNock.get("/rest/api/latest/issue/TEST-123?fields=summary")
				.reply(200, {
					key: "TEST-123",
					fields: {
						summary: "Example Issue",
					},
				});*/

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
							lastUpdated: "2021-06-28T12:15:18Z",
							state: "in_progress",
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
