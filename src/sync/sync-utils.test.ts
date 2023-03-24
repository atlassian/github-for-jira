import { findOrStartSync } from "./sync-utils";
import { sqsQueues } from "../sqs/queues";
import { Subscription, TaskStatus } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
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

const logger = getLogger("test");

describe("findOrStartSync", () => {
	describe("Syncing logic", () => {
		const JIRA_INSTALLATION_ID = 1111;
		const JIRA_CLIENT_KEY = "jira-client-key";
		const CUTOFF_IN_MSECS = 1000;
		const CUTOFF_IN_MSECS__DISABLED = -1;
		describe("Resetting task", () => {
			let subscription: Subscription;
			let repo1: RepoSyncState;
			let repo2: RepoSyncState;
			const repoSync = (seq: number, status: TaskStatus): Partial<RepoSyncState> => ({
				"repoId": seq,
				"repoUrl": "",
				"repoName": `repo${seq}`,
				"repoOwner": "owner",
				"repoFullName": `repo${seq} full`,
				"pullStatus": status,
				"pullCursor": `pull${seq}`,
				"buildStatus": status,
				"buildCursor": `build${seq}`,
				"deploymentStatus": status,
				"deploymentCursor": `deployment${seq}`,
				"failedCode": `failed for ${seq}`
			});
			const reloadFromDB = async () => {
				await subscription.reload();
				await repo1.reload();
				await repo2.reload();
			};
			beforeEach(async () => {
				subscription = await Subscription.install({
					installationId: JIRA_INSTALLATION_ID,
					host: jiraHost,
					hashedClientKey: JIRA_CLIENT_KEY,
					gitHubAppId: undefined
				});
				await subscription.update({
					totalNumberOfRepos: 2,
					repositoryStatus: "complete",
					repositoryCursor: "done"
				});
				repo1 = await RepoSyncState.createForSubscription(subscription, repoSync(1, "complete"));
				repo2 = await RepoSyncState.createForSubscription(subscription, repoSync(2, "pending"));
			});
			it("Full Sync: should NOT reset repository cursor / status if repository task is NOT provided", async () => {
				await findOrStartSync(subscription, logger, "full", undefined, ["build"], undefined);
				await reloadFromDB();
				expect(subscription.totalNumberOfRepos).toBe(2);
				expect(subscription.repositoryStatus).toBe("complete");
				expect(subscription.repositoryCursor).toBe("done");
				expect(repo1).toEqual(expect.objectContaining({
					...repoSync(1, "complete"),
					"buildStatus": null,
					"buildCursor": null,
					"failedCode": null
				}));
				expect(repo2).toEqual(expect.objectContaining({
					...repoSync(2, "pending"),
					"buildStatus": null,
					"buildCursor": null,
					"failedCode": null
				}));
			});
			it("Full Sync: should reset repository cursor / status if repository task is provided", async () => {
				await findOrStartSync(subscription, logger, "full", undefined, ["repository"], undefined);
				await reloadFromDB();
				expect(subscription.totalNumberOfRepos).toBe(null);
				expect(subscription.repositoryStatus).toBe(null);
				expect(subscription.repositoryCursor).toBe(null);
			});
			it("Full Sync: should NOT reset repository status and cursor if repository tasks it NOT provded", async () => {
				await findOrStartSync(subscription, logger, "full", undefined, ["build"], undefined);
				await reloadFromDB();
				expect(subscription.totalNumberOfRepos).toBe(2);
				expect(subscription.repositoryStatus).toBe("complete");
				expect(subscription.repositoryCursor).toBe("done");
			});
			it("Full Sync: should remove all RepoSyncStates and reset subscription if NO target tasks provded", async () => {
				await findOrStartSync(subscription, logger, "full", undefined, undefined, undefined);
				await subscription.reload();
				const countOfRepo = await RepoSyncState.count({ where: { subscriptionId: subscription.id } });
				expect(countOfRepo).toBe(0);
				expect(subscription.totalNumberOfRepos).toBe(null);
				expect(subscription.repositoryStatus).toBe(null);
				expect(subscription.repositoryCursor).toBe(null);
			});
			it("Full Sync: should reset both status and cursor for those target tasks provded", async () => {
				await findOrStartSync(subscription, logger, "full", undefined, ["build"], undefined);
				await reloadFromDB();
				const countOfRepo = await RepoSyncState.count({ where: { subscriptionId: subscription.id } });
				expect(countOfRepo).toBe(2);
				expect(repo1).toEqual(expect.objectContaining({
					...repoSync(1, "complete"),
					"buildStatus": null,
					"buildCursor": null,
					"failedCode": null
				}));
				expect(repo2).toEqual(expect.objectContaining({
					...repoSync(2, "pending"),
					"buildStatus": null,
					"buildCursor": null,
					"failedCode": null
				}));
			});
			it("Partial Sync: should NOT any reset status for all tasks when provided target task is empty", async () => {
				await findOrStartSync(subscription, logger, "partial", undefined, undefined, undefined);
				await reloadFromDB();
				expect(repo1).toEqual(expect.objectContaining({
					...repoSync(1, "complete")
				}));
				expect(repo2).toEqual(expect.objectContaining({
					...repoSync(2, "pending")
				}));
			});
			it("Partial Sync: should only reset status for tasks in provided target task", async () => {
				await findOrStartSync(subscription, logger, "partial", undefined, [ "build" ], undefined);
				await reloadFromDB();
				expect(repo1).toEqual(expect.objectContaining({
					...repoSync(1, "complete"),
					"buildStatus": null
				}));
				expect(repo2).toEqual(expect.objectContaining({
					...repoSync(2, "pending"),
					"buildStatus": null
				}));
			});
		});
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
				await findOrStartSync(subscription, logger, "partial", providedCommitSinceDate, undefined);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(
					expect.objectContaining({ commitsFromDate: providedCommitSinceDate.toISOString() }),
					expect.anything(), expect.anything());
			});
			it("should send a specific commit since date in the msg payload even if not provided", async () => {
				when(jest.mocked(numberFlag))
					.calledWith(NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, expect.anything(), jiraHost)
					.mockResolvedValue(CUTOFF_IN_MSECS);
				const targetCommitsFromDate = new Date(DATE_NOW.getTime() - CUTOFF_IN_MSECS);
				await findOrStartSync(subscription, logger, "partial", undefined, undefined);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(
					expect.objectContaining({ commitsFromDate: targetCommitsFromDate.toISOString() }),
					expect.anything(), expect.anything());
			});
			it("should  send undefined commit since date in the msg payload if flag is set to -1 for main commits from date", async () => {
				when(jest.mocked(numberFlag))
					.calledWith(NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, expect.anything(), jiraHost)
					.mockResolvedValue(CUTOFF_IN_MSECS__DISABLED);
				await findOrStartSync(subscription, logger, "partial", undefined, undefined);
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(
					expect.objectContaining({ commitsFromDate: undefined }),
					expect.anything(), expect.anything());
			});
			it("should  send undefined commit since date in the msg payload if flag is set to -1 for branch commits from date", async () => {
				when(jest.mocked(numberFlag))
					.calledWith(NumberFlags.SYNC_BRANCH_COMMIT_TIME_LIMIT, expect.anything(), jiraHost)
					.mockResolvedValue(CUTOFF_IN_MSECS__DISABLED);
				await findOrStartSync(subscription, logger, "partial", undefined, undefined);
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
					logger,
					"partial",
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
					logger,
					"partial",
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
