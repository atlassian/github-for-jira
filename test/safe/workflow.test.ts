/* eslint-disable @typescript-eslint/no-var-requires */
import { createWebhookApp } from "../utils/probot";
import { Application } from "probot";
import { Installation, Subscription } from "../../src/models";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../../src/config/feature-flags";

jest.mock("../../src/config/feature-flags");

describe.each([true, false])("Workflow Webhook", (useNewGithubClient) => {
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

		when(booleanFlag).calledWith(
			BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_WORKFLOW_WEBHOOK,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(useNewGithubClient);

		if(useNewGithubClient) {
			githubUserTokenNock(gitHubInstallationId);
		}
	});

	describe(`workflow_run - useNewGithubClient '${useNewGithubClient}'`, () => {
		it("should update the Jira issue with the linked GitHub workflow_run", async () => {
			const fixture = require("../fixtures/workflow-basic.json");

			githubNock.get("/repos/test-repo-owner/test-repo-name/compare/f95f852bd8fca8fcc58a9a2d6c842781e32a215e...ec26c3e57ca3a959ca5aad62de7213c562f8c821", {
				"status": "behind",
				"ahead_by": 1,
				"behind_by": 2,
				"total_commits": 1,
				"commits": [
					{
						"commit": {
							"message": "Fix all the bugs",
						},
					}
				]
			});

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

			mockSystemTime(12345678);

			await expect(app.receive(fixture)).toResolve();
		});
	});
});
