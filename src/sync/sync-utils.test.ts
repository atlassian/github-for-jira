import { findOrStartSync } from "./sync-utils";
import { sqsQueues } from "../sqs/queues";
import { Subscription } from "models/subscription";
import { GitHubServerApp } from "models/github-server-app";
import { getLogger } from "config/logger";
import { v4 as uuid } from "uuid";
import { envVars } from "config/env";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { when } from "jest-when";

jest.mock("../sqs/queues");
jest.mock("config/feature-flags");

const DATE_NOW = new Date("2023-03-04T05:06:07.000Z");
jest.useFakeTimers().setSystemTime(DATE_NOW);

describe("findOrStartSync", () => {
	describe("Syncing logic", () => {
		const JIRA_INSTALLATION_ID = 1111;
		const JIRA_CLIENT_KEY = "jira-client-key";
		const CUTOFF_IN_MSECS = 1000;
		const CUTOFF_IN_MSECS__DISABLED = -1;
		describe("commit since date", () => {
			let subscription: Subscription;
			beforeEach(async () => {
				subscription = await Subscription.install({
					installationId: JIRA_INSTALLATION_ID,
					host: jiraHost,
					hashedClientKey: JIRA_CLIENT_KEY,
					gitHubAppId: undefined
				});
			});
			it("should send a specific commit since date in the msg payload if provided", async () => {
				const providedCommitSinceDate = new Date();
				await findOrStartSync(subscription, getLogger("test"), true, undefined, providedCommitSinceDate, undefined);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(
					expect.objectContaining({ commitsFromDate: providedCommitSinceDate.toISOString() }),
					expect.anything(), expect.anything());
			});
			it("should send a specific commit since date in the msg payload even if not provided", async () => {
				when(jest.mocked(numberFlag))
					.calledWith(NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, expect.anything(), jiraHost)
					.mockResolvedValue(CUTOFF_IN_MSECS);
				const targetCommitsFromDate = new Date(DATE_NOW.getTime() - CUTOFF_IN_MSECS);
				await findOrStartSync(subscription, getLogger("test"), true, undefined, undefined, undefined);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(
					expect.objectContaining({ commitsFromDate: targetCommitsFromDate.toISOString() }),
					expect.anything(), expect.anything());
			});
			it("should  send undefined commit since date in the msg payload if flag is set to -1 for main commits from date", async () => {
				when(jest.mocked(numberFlag))
					.calledWith(NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, expect.anything(), jiraHost)
					.mockResolvedValue(CUTOFF_IN_MSECS__DISABLED);
				await findOrStartSync(subscription, getLogger("test"), true, undefined, undefined, undefined);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(
					expect.objectContaining({ commitsFromDate: undefined }),
					expect.anything(), expect.anything());
			});
			it("should  send undefined commit since date in the msg payload if flag is set to -1 for branch commits from date", async () => {
				when(jest.mocked(numberFlag))
					.calledWith(NumberFlags.SYNC_BRANCH_COMMIT_TIME_LIMIT, expect.anything(), jiraHost)
					.mockResolvedValue(CUTOFF_IN_MSECS__DISABLED);
				await findOrStartSync(subscription, getLogger("test"), true, undefined, undefined, undefined);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(
					expect.objectContaining({ branchCommitsFromDate: undefined }),
					expect.anything(), expect.anything());
			});
		});
	});
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
					true,
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
					true,
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
