import { findOrStartSync, scaleCursor } from "./sync-utils";
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

describe("sync utils", () => {
	describe("findOrStartSync: Syncing logic", () => {
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
				await findOrStartSync(subscription, getLogger("test"), undefined, providedCommitSinceDate, undefined);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(
					expect.objectContaining({ commitsFromDate: providedCommitSinceDate.toISOString() }),
					expect.anything(), expect.anything());
			});
			it("should send a specific commit since date in the msg payload even if not provided", async () => {
				when(jest.mocked(numberFlag))
					.calledWith(NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, expect.anything(), jiraHost)
					.mockResolvedValue(CUTOFF_IN_MSECS);
				const targetCommitsFromDate = new Date(DATE_NOW.getTime() - CUTOFF_IN_MSECS);
				await findOrStartSync(subscription, getLogger("test"), undefined, undefined, undefined);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(
					expect.objectContaining({ commitsFromDate: targetCommitsFromDate.toISOString() }),
					expect.anything(), expect.anything());
			});
			it("should  send undefined commit since date in the msg payload if flag is set to -1 for main commits from date", async () => {
				when(jest.mocked(numberFlag))
					.calledWith(NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, expect.anything(), jiraHost)
					.mockResolvedValue(CUTOFF_IN_MSECS__DISABLED);
				await findOrStartSync(subscription, getLogger("test"), undefined, undefined, undefined);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(
					expect.objectContaining({ commitsFromDate: undefined }),
					expect.anything(), expect.anything());
			});
			it("should  send undefined commit since date in the msg payload if flag is set to -1 for branch commits from date", async () => {
				when(jest.mocked(numberFlag))
					.calledWith(NumberFlags.SYNC_BRANCH_COMMIT_TIME_LIMIT, expect.anything(), jiraHost)
					.mockResolvedValue(CUTOFF_IN_MSECS__DISABLED);
				await findOrStartSync(subscription, getLogger("test"), undefined, undefined, undefined);
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

	describe("scaleCursor", () => {
		describe("increase page size", () => {
			const ORIG_PAGE_SIZE = 20;
			const NEW_PAGE_SIZE = 100;

			it("maps first page to the first page", () => {
				expect(scaleCursor({
					pageNo: 1,
					perPage: ORIG_PAGE_SIZE
				}, NEW_PAGE_SIZE)).toStrictEqual({
					pageNo: 1,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("maps first pages to the first page if data hasn't been fetched yet for the scaled page", () => {
				expect(scaleCursor({
					pageNo: 5, // only 4 small pages were fetched
					perPage: ORIG_PAGE_SIZE
				}, NEW_PAGE_SIZE)).toStrictEqual({
					pageNo: 1,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("maps to the second page as soon as the scaled page was fully fetched", () => {
				expect(scaleCursor({
					pageNo: 6, // 5 small pages were fetched
					perPage: ORIG_PAGE_SIZE
				}, NEW_PAGE_SIZE)).toStrictEqual({
					pageNo: 2,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("maps to the second page if the whole first scaled page was fetched", () => {
				expect(scaleCursor({
					pageNo: 6, // 5 small pages were fetched = 100 PRs => need to fetch 2nd scaled page
					perPage: ORIG_PAGE_SIZE
				}, NEW_PAGE_SIZE)).toStrictEqual({
					pageNo: 2,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("maps to the second page while the 2nd scaled page wasn't fully fetched", () => {
				expect(scaleCursor({
					pageNo: 10, // 9 small pages were fetched = 180 PRs => still need to fetch 2nd scaled page
					perPage: ORIG_PAGE_SIZE
				}, NEW_PAGE_SIZE)).toStrictEqual({
					pageNo: 2,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("maps to the third page when the 2nd scaled page is fully fetched", () => {
				expect(scaleCursor({
					pageNo: 11, // 10 small pages were fetched = 200 PRs => need to fetch 3rd page
					perPage: ORIG_PAGE_SIZE
				}, NEW_PAGE_SIZE)).toStrictEqual({
					pageNo: 3,
					perPage: NEW_PAGE_SIZE
				});
			});
		});

		describe("decrease page size", () => {
			const ORIG_PAGE_SIZE = 100;
			const NEW_PAGE_SIZE = 20;

			it("maps first page to the first page", () => {
				expect(scaleCursor({
					pageNo: 1,
					perPage: ORIG_PAGE_SIZE
				}, NEW_PAGE_SIZE)).toStrictEqual({
					pageNo: 1,
					perPage: NEW_PAGE_SIZE
				});
			});

			it("skips first scaled pages when the original (large) page was processed", () => {
				expect(scaleCursor({
					pageNo: 2, // 100 PRs were processed, which is 5 scaled pages. Must point to 6
					perPage: ORIG_PAGE_SIZE
				}, NEW_PAGE_SIZE)).toStrictEqual({
					pageNo: 6,
					perPage: NEW_PAGE_SIZE
				});
			});
		});

		describe("same page size", () => {
			it("does nothing", () => {
				expect(scaleCursor({
					pageNo: 1,
					perPage: 17
				}, 17)).toStrictEqual({
					pageNo: 1,
					perPage: 17
				});

				expect(scaleCursor({
					pageNo: 16,
					perPage: 17
				}, 17)).toStrictEqual({
					pageNo: 16,
					perPage: 17
				});
			});
		});
	});
});
