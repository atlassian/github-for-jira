/* eslint-disable @typescript-eslint/no-var-requires */
import { createWebhookApp } from "../utils/probot";
import { Application } from "probot";
import { Installation, Subscription } from "../../src/models";

describe("Workflow Webhook", () => {
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

	describe("workflow_run", () => {
		beforeEach(() => {
			jest.setTimeout(20000);
		});
		it("should update the Jira issue with the linked GitHub workflow_run", async () => {
			const fixture = require("../fixtures/workflow-basic.json");

			// TODO: need to start validating all issue keys with jira
			/*jiraNock.get("/rest/api/latest/issue/TEST-123?fields=summary")
				.reply(200, {
					key: "TEST-123",
					fields: {
						summary: "Example Issue"
					}
				});*/


			jiraNock.post("/rest/builds/0.1/bulk", {
				builds:
					[
						{
							schemaVersion: "1.0",
							pipelineId: 9751894,
							buildNumber: 84,
							updateSequenceNumber: 12345678,
							displayName: "My Deployment flow",
							url: "test-repo-url",
							state: "in_progress",
							lastUpdated: "2021-06-28T03:53:34Z",
							issueKeys: ["TES-123"],
							references:
								[
									{
										commit:
											{
												id: "ec26c3e57ca3a959ca5aad62de7213c562f8c821",
												repositoryUri: "https://api.github.com/repos/test-repo-owner/test-repo-name"
											},
										ref:
											{
												name: "changes",
												uri: "https://api.github.com/repos/test-repo-owner/test-repo-name/tree/changes"
											}
									}
								]
						}
					],
				properties:
					{
						gitHubInstallationId: 1234
					},
				providerMetadata:
					{
						product: "GitHub Actions"
					}
			}).reply(200);

			Date.now = jest.fn(() => 12345678);

			await expect(app.receive(fixture)).toResolve();
		});
	});
});
