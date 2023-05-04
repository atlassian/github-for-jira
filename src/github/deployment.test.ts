import { deploymentWebhookHandler } from "./deployment";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { sqsQueues } from "../sqs/queues";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import deploymentStatusBasicFixture from "fixtures/deployment_status-basic.json";
import { createWebhookApp, WebhookApp } from "test/utils/create-webhook-app";
import { Subscription } from "models/subscription";
import { Installation } from "models/installation";

jest.mock("../sqs/queues");

const GITHUB_INSTALLATION_ID = 1234;
const GHES_GITHUB_APP_ID = 111;
const GHES_GITHUB_UUID = "xxx-xxx-xxx-xxx";
const GHES_GITHUB_APP_APP_ID = 1;
const GHES_GITHUB_APP_CLIENT_ID = "client-id";

describe("DeploymentWebhookHandler", () => {
	let jiraClient: any;
	let util: any;
	let app: WebhookApp;

	beforeEach(async () => {
		jiraClient = { baseURL: jiraHost };
		util = null;

		await Subscription.create({
			gitHubInstallationId: GITHUB_INSTALLATION_ID,
			jiraHost
		});

		await Installation.create({
			jiraHost,
			clientKey: "client-key",
			encryptedSharedSecret: "shared-secret"
		});

		githubUserTokenNock(GITHUB_INSTALLATION_ID);
	});

	describe("GitHub Cloud", () => {
		it("should be called with cloud GitHubAppConfig", async () => {
			await deploymentWebhookHandler(getWebhookContext({ cloud: true }), jiraClient, util, GITHUB_INSTALLATION_ID);
			expect(sqsQueues.deployment.sendMessage).toBeCalledWith(expect.objectContaining({
				gitHubAppConfig: {
					uuid: undefined,
					gitHubAppId: undefined,
					appId: parseInt(envVars.APP_ID),
					clientId: envVars.GITHUB_CLIENT_ID,
					gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
					gitHubApiUrl: GITHUB_CLOUD_API_BASEURL
				}
			}));
		});
	});

	describe("GitHub Enterprise Server", () => {
		it("should be called with GHES GitHubAppConfig", async () => {
			await deploymentWebhookHandler(getWebhookContext({ cloud: false }), jiraClient, util, GITHUB_INSTALLATION_ID);
			expect(sqsQueues.deployment.sendMessage).toBeCalledWith(expect.objectContaining({
				gitHubAppConfig: {
					uuid: GHES_GITHUB_UUID,
					gitHubAppId: GHES_GITHUB_APP_ID,
					appId: GHES_GITHUB_APP_APP_ID,
					clientId: GHES_GITHUB_APP_CLIENT_ID,
					gitHubBaseUrl: gheUrl,
					gitHubApiUrl: gheUrl
				}
			}));
		});
	});

	const getWebhookContext = ({ cloud }: {cloud: boolean}) => {
		return new WebhookContext({
			id: "1",
			name: "created",
			log: getLogger("test"),
			payload: {},
			gitHubAppConfig: cloud ? {
				uuid: undefined,
				gitHubAppId: undefined,
				appId: parseInt(envVars.APP_ID),
				clientId: envVars.GITHUB_CLIENT_ID,
				gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
				gitHubApiUrl: GITHUB_CLOUD_API_BASEURL
			} : {
				uuid: GHES_GITHUB_UUID,
				gitHubAppId: GHES_GITHUB_APP_ID,
				appId: GHES_GITHUB_APP_APP_ID,
				clientId: GHES_GITHUB_APP_CLIENT_ID,
				gitHubBaseUrl: gheUrl,
				gitHubApiUrl: gheUrl
			}
		});
	};

	it("should update the Jira issue with the linked GitHub deployment_status", async () => {
		app = await createWebhookApp();

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

		jiraNock.post("/rest/deployments/0.1/bulk", {
			deployments:
				[
					{
						schemaVersion: "1.0",
						deploymentSequenceNumber: 892341295,
						updateSequenceNumber: 1940683605,
						displayName: "TEST-319",
						url: "https://github.com/test-org/test-repo/actions/runs/4878403971/jobs/8703999344",
						description: "deploy",
						lastUpdated: "2023-05-04T02:11:44.000Z",
						state: "in_progress",
						pipeline: {
							id: "deploy",
							displayName: "deploy",
							url: "https://github.com/test-org/test-repo/actions/runs/4878403971/jobs/8703999344"
						},
						environment: {
							id: "production",
							displayName: "production",
							type: "production"
						},
						associations: [
							{
								associationType: "issueIdOrKeys",
								values: [
									"TEST-319"
								]
							},
							{
								associationType: "commit",
								values: [
									{
										commitHash: "787b6fe0b699197329a5b52dfb1c601241cec9c7",
										repositoryId: "123"
									}
								]
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

		await expect(app.receive(deploymentStatusBasicFixture)).toResolve();
	});
});

