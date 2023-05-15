import { deploymentWebhookHandler, processDeployment } from "./deployment";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { sqsQueues } from "../sqs/queues";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { saveDeploymentInfo } from "models/deployment-service";
import deployment_status from "fixtures/deployment_status-basic.json";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";

jest.mock("../sqs/queues");
jest.mock("models/deployment-service");
jest.mock("config/feature-flags");
jest.mock("../transforms/transform-deployment");


const GITHUB_INSTALLATION_ID = 1234;
const GHES_GITHUB_APP_ID = 111;
const GHES_GITHUB_UUID = "xxx-xxx-xxx-xxx";
const GHES_GITHUB_APP_APP_ID = 1;
const GHES_GITHUB_APP_CLIENT_ID = "client-id";

const logger = getLogger("test");

describe("DeploymentWebhookHandler", () => {
	let jiraClient: any;
	let util: any;
	beforeEach(() => {
		jiraClient = { baseURL: jiraHost };
		util = null;
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
	describe("Processing deployment", () => {
		let gitHubInstallationId;
		let gitHubInstallationClient;
		let payload: WebhookPayloadDeploymentStatus;
		describe("Persistent to dynamoDB", () => {
			beforeEach(async () => {
				gitHubInstallationId = deployment_status.payload.installation.id;
				when(booleanFlag).calledWith(BooleanFlags.USE_DYNAMODB_FOR_DEPLOYMENT_WEBHOOK, expect.anything()).mockResolvedValue(true);
				gitHubInstallationClient = await createInstallationClient(
					gitHubInstallationId,
					jiraHost,
					{ trigger: "test", subTrigger: "test" },
					logger,
					undefined
				);
				payload = JSON.parse(JSON.stringify(deployment_status.payload)) as WebhookPayloadDeploymentStatus;
			});
			it("should call to persist deployment info for success deployment status", async () => {
				await processDeployment(
					gitHubInstallationClient,
					"webhook-id",
					payload,
					new Date(),
					jiraHost,
					gitHubInstallationId,
					logger,
					undefined
				);
				expect(jest.mocked(saveDeploymentInfo)).toBeCalledWith({
					gitHubBaseUrl: "https://github.com",
					gitHubInstallationId: deployment_status.payload.installation.id,
					repositoryId: deployment_status.payload.repository.id,
					commitSha: "f95f852bd8fca8fcc58a9a2d6c842781e32a215e",
					description: "",
					env: "Production",
					status: "success",
					createdAt: new Date(deployment_status.payload.deployment_status.created_at)
				}, expect.anything());
			});
			it("should NOT call to persist deployment info for non-success deployment status", async () => {
				payload.deployment_status.state = "failure";
				await processDeployment(
					gitHubInstallationClient,
					"webhook-id",
					payload,
					new Date(),
					jiraHost,
					gitHubInstallationId,
					logger,
					undefined
				);
				expect(jest.mocked(saveDeploymentInfo)).not.toBeCalled();
			});
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
});

