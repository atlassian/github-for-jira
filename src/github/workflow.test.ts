import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import workflowBasicFixture from "fixtures/workflow-basic.json";
import { createWebhookApp, WebhookApp } from "test/utils/create-webhook-app";
const lastMockedWorkflowSubmitFn = jest.fn();
jest.mock("../jira/client/jira-client", () => ({
	getJiraClient: async (...args) => {
		const actual = await jest.requireActual("../jira/client/jira-client").getJiraClient(...args);
		return {
			...actual,
			workflow: {
				...actual.workflow,
				submit: (...repoArgs) => {
					lastMockedWorkflowSubmitFn(...repoArgs);
					return actual.workflow.submit(...repoArgs);
				}
			}
		};
	}
}));


describe("Workflow Webhook", () => {
	let app: WebhookApp;
	const gitHubInstallationId = 1234;
	let subscriptionId;

	beforeEach(async () => {
		app = await createWebhookApp();

		subscriptionId = (await Subscription.create({
			gitHubInstallationId,
			jiraHost
		})).id;

		await Installation.create({
			jiraHost,
			clientKey: "client-key",
			encryptedSharedSecret: "shared-secret"
		});

		githubUserTokenNock(gitHubInstallationId);
	});

	it("should update the Jira issue with the linked GitHub workflow_run", async () => {

		githubNock.get("/repos/test-repo-owner/test-repo-name/compare/f95f852bd8fca8fcc58a9a2d6c842781e32a215e...ec26c3e57ca3a959ca5aad62de7213c562f8c821", {
			"status": "behind",
			"ahead_by": 1,
			"behind_by": 2,
			"total_commits": 1,
			"commits": [
				{
					"commit": {
						"message": "Fix all the bugs"
					}
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
					gitHubInstallationId: 1234,
					repositoryId: 123
				},
			providerMetadata:
				{
					product: "GitHub Actions"
				},
			preventTransitions: false,
			operationType: "NORMAL"
		}).reply(200);

		mockSystemTime(12345678);

		await expect(app.receive(workflowBasicFixture)).toResolve();

		expect(lastMockedWorkflowSubmitFn).toBeCalledWith(
			expect.anything(),
			123,
			expect.objectContaining({
				auditLogsource: "WEBHOOK",
				entityAction: "WORKFLOW_RUN_REQUESTED",
				subscriptionId
			})
		);
	});
});
