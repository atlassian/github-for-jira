import { deploymentWebhookHandler } from "./deployment";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { sqsQueues } from "../sqs/queues";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { Subscription } from "models/subscription";
import deployment_status from "fixtures/deployment_status-basic.json";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";
import type { DeploymentStatusEvent } from "@octokit/webhooks-types";
import { dynamodb as ddb } from "config/dynamodb";
import { createHashWithoutSharedSecret } from "utils/encryption";

jest.mock("../sqs/queues");
jest.mock("config/feature-flags");
jest.mock("../transforms/transform-deployment");


const GITHUB_INSTALLATION_ID = 1234;
const GHES_GITHUB_APP_ID = 111;
const GHES_GITHUB_UUID = "xxx-xxx-xxx-xxx";
const GHES_GITHUB_APP_APP_ID = 1;
const GHES_GITHUB_APP_CLIENT_ID = "client-id";

const ONE_YEAR_IN_MILLISECONDS = 365 * 24 * 60 * 60 * 1000;

describe("DeploymentWebhookHandler", () => {
	let jiraClient: any;
	let util: any;
	let subscription: Subscription;
	beforeEach(async () => {
		jiraClient = { baseURL: jiraHost };
		util = null;
		subscription = await Subscription.install({
			host: jiraHost,
			hashedClientKey: "1234",
			gitHubAppId: undefined,
			installationId: GITHUB_INSTALLATION_ID
		});
	});
	describe("GitHub Cloud", () => {
		it("should be called with cloud GitHubAppConfig", async () => {
			await deploymentWebhookHandler(getWebhookContext({ cloud: true }), jiraClient, util, GITHUB_INSTALLATION_ID, subscription);
			expect(sqsQueues.deployment.sendMessage).toBeCalledWith(expect.objectContaining({
				gitHubAppConfig: {
					uuid: undefined,
					gitHubAppId: undefined,
					appId: parseInt(envVars.APP_ID),
					clientId: envVars.GITHUB_CLIENT_ID,
					gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
					gitHubApiUrl: GITHUB_CLOUD_API_BASEURL
				}
			}), 0, expect.anything());
		});
	});
	describe("GitHub Enterprise Server", () => {
		it("should be called with GHES GitHubAppConfig", async () => {
			await deploymentWebhookHandler(getWebhookContext({ cloud: false }), jiraClient, util, GITHUB_INSTALLATION_ID, subscription);
			expect(sqsQueues.deployment.sendMessage).toBeCalledWith(expect.objectContaining({
				gitHubAppConfig: {
					uuid: GHES_GITHUB_UUID,
					gitHubAppId: GHES_GITHUB_APP_ID,
					appId: GHES_GITHUB_APP_APP_ID,
					clientId: GHES_GITHUB_APP_CLIENT_ID,
					gitHubBaseUrl: gheUrl,
					gitHubApiUrl: gheUrl
				}
			}), 0, expect.anything());
		});
	});
	describe("Processing webhook", () => {
		let payload: DeploymentStatusEvent;
		describe("Persistent to dynamoDB", () => {
			beforeEach(async () => {
				when(booleanFlag).calledWith(BooleanFlags.USE_DYNAMODB_FOR_DEPLOYMENT_WEBHOOK, expect.anything()).mockResolvedValue(true);
				payload = JSON.parse(JSON.stringify(deployment_status.payload)) as DeploymentStatusEvent;
			});
			it("should call to persist deployment info for success deployment status", async () => {
				await deploymentWebhookHandler({ ...getWebhookContext({ cloud: true }), payload }, jiraClient, util, GITHUB_INSTALLATION_ID, subscription);
				expect(await expectAndVerifyResult(
					"https://github.com",
					deployment_status.payload.repository.id,
					"f95f852bd8fca8fcc58a9a2d6c842781e32a215e",
					"Production",
					new Date(deployment_status.payload.deployment_status.created_at),
					new Date(new Date(deployment_status.payload.deployment_status.created_at).getTime() + ONE_YEAR_IN_MILLISECONDS)
				)).toBe(true);
			});
			it("should NOT call to persist deployment info for non-success deployment status", async () => {
				payload.deployment_status.state = "failure";
				await deploymentWebhookHandler({ ...getWebhookContext({ cloud: true }), payload }, jiraClient, util, GITHUB_INSTALLATION_ID, subscription);
				const result = await ddb.scan({
					TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME
				}).promise();
				expect(result.$response.error).toBeNull();
				expect(result.Items).toEqual([]);
			});
		});
	});

	const expectAndVerifyResult = async (
		gitHubBaseUrl: string,
		repoId: number,
		commitSha: string,
		env: string,
		createdAt: Date,
		expiredAfter: Date
	) => {
		const key = createHashWithoutSharedSecret(`ghurl_${gitHubBaseUrl}_repo_${repoId}_env_${env}`);
		const result = await ddb.getItem({
			TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME,
			Key: {
				"Id": { "S": key },
				"CreatedAt": { "N": String(createdAt.getTime()) }
			},
			AttributesToGet: [
				"Id", "CreatedAt",
				"GitHubInstallationId", "GitHubAppId", "RepositoryId",
				"CommitSha",
				"Env", "Status", "ExpiredAfter"
			]
		}).promise();

		expect(result.$response.error).toBeNull();
		expect(result.Item).toEqual({
			Id: { "S": key },
			CreatedAt: { "N": String(createdAt.getTime()) },
			CommitSha: { "S": commitSha },
			ExpiredAfter: { "N": String(Math.floor(expiredAfter.getTime() / 1000)) }
		});

		return true;
	};

	const getWebhookContext = ({ cloud }: {cloud: boolean}) => {
		return new WebhookContext({
			id: "1",
			name: "created",
			log: getLogger("test"),
			payload: deployment_status.payload,
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

