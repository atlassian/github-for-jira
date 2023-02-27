import { findOrStartSync } from "./sync-utils";
import { sqsQueues } from "../sqs/queues";
import { Subscription } from "models/subscription";
import { GitHubServerApp } from "models/github-server-app";
import { getLogger } from "config/logger";
import { v4 as uuid } from "uuid";
import { envVars } from "config/env";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";

jest.mock("../sqs/queues");

describe("findOrStartSync", () => {
	describe("GitHubAppConfig", () => {
		const JIRA_INSTALLATION_ID = 1111;
		const JIRA_CLIENT_KEY = "jira-client-key";
		describe("Cloud", () => {
			let subscription: Subscription;
			beforeEach(async () => {
				subscription = await Subscription.install({
					installationId: JIRA_INSTALLATION_ID,
					host: jiraHost,
					hashedClientKey: JIRA_CLIENT_KEY,
					gitHubAppId: undefined
				});
			});
			it("should send cloud gitHubAppConfig to msg queue", async () => {
				await findOrStartSync(
					subscription,
					getLogger("test"),
					undefined,
					undefined,
					undefined
				);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(expect.objectContaining({
					gitHubAppConfig: {
						appId: parseInt(envVars.APP_ID),
						clientId: envVars.GITHUB_CLIENT_ID,
						gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
						gitHubApiUrl: GITHUB_CLOUD_API_BASEURL
					}
				}), expect.anything(), expect.anything());
			});
		});
		describe("Enterprise server", () => {
			const GHES_GITHUB_UUID = uuid();
			const GHES_GITHUB_APP_ID = 1234;
			const GHES_GITHUB_APP_NAME = "test_app";
			const GHES_GITHUB_BASE_URL = "https://whatever.url";
			const GHES_GITHUB_APP_CLIENT_ID = "client_id";
			const GHES_GITHUB_APP_CLIENT_SECRET = "client_secret";
			const GHES_GITHUB_APP_WEBHOOK_SECRET = "webhook_secret";
			const GHES_GITHUB_APP_PRIVATE_KEY = "private_key";
			let gitHubServerApp: GitHubServerApp;
			let subscription: Subscription;
			beforeEach(async () => {
				gitHubServerApp = await GitHubServerApp.install({
					uuid: GHES_GITHUB_UUID,
					appId: GHES_GITHUB_APP_ID,
					gitHubBaseUrl: GHES_GITHUB_BASE_URL,
					gitHubClientId: GHES_GITHUB_APP_CLIENT_ID,
					gitHubClientSecret: GHES_GITHUB_APP_CLIENT_SECRET,
					webhookSecret: GHES_GITHUB_APP_WEBHOOK_SECRET,
					privateKey: GHES_GITHUB_APP_PRIVATE_KEY,
					gitHubAppName: GHES_GITHUB_APP_NAME,
					installationId: JIRA_INSTALLATION_ID
				}, jiraHost);
				subscription = await Subscription.install({
					installationId: JIRA_INSTALLATION_ID,
					host: jiraHost,
					gitHubAppId: gitHubServerApp.id,
					hashedClientKey: JIRA_CLIENT_KEY
				});
			});
			it("should send ghes gitHubAppConfig to msg queue", async () => {
				await findOrStartSync(
					subscription,
					getLogger("test"),
					undefined,
					undefined,
					undefined
				);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(expect.objectContaining({
					gitHubAppConfig: {
						gitHubAppId: gitHubServerApp.id,
						appId: GHES_GITHUB_APP_ID,
						clientId: GHES_GITHUB_APP_CLIENT_ID,
						gitHubBaseUrl: GHES_GITHUB_BASE_URL,
						gitHubApiUrl: GHES_GITHUB_BASE_URL,
						uuid: GHES_GITHUB_UUID
					}
				}), expect.anything(), expect.anything());
			});
		});
	});
});
