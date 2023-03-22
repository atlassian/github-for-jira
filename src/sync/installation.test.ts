import {
	getTargetTasks,
	handleBackfillError,
	isRetryableWithSmallerRequest, markCurrentTaskAsFailedAndContinue,
	processInstallation,
	TaskError, updateTaskStatusAndContinue
} from "~/src/sync/installation";
import { Task, TaskType } from "~/src/sync/sync.types";
import { DeduplicatorResult } from "~/src/sync/deduplicator";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import {
	GithubClientError,
	GithubClientRateLimitingError,
	GithubNotFoundError
} from "~/src/github/client/github-client-errors";
import { Repository, Subscription, SyncStatus } from "models/subscription";
import { v4 as UUID } from "uuid";
import { ConnectionTimedOutError } from "sequelize";
import { AxiosError } from "axios";
import { createAnonymousClient } from "utils/get-github-client-config";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { RepoSyncState } from "models/reposyncstate";
import { branchesNoLastCursor } from "fixtures/api/graphql/branch-queries";
import branchNodesFixture from "fixtures/api/graphql/branch-ref-nodes.json";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";

const mockedExecuteWithDeduplication = jest.fn().mockResolvedValue(DeduplicatorResult.E_OK);
jest.mock("~/src/sync/deduplicator", () => ({
	...jest.requireActual("~/src/sync/deduplicator"),
	Deduplicator: function() {
		return { executeWithDeduplication: mockedExecuteWithDeduplication };
	}
}));

describe("sync/installation", () => {

	let MESSAGE_PAYLOAD;
	let MESSAGE_PAYLOAD_GHE;
	let repoSyncState: RepoSyncState;
	let subscription: Subscription;

	const TEST_LOGGER = getLogger("test");
	const GITHUB_APP_ID = 123;

	const TEST_REPO: Repository = {
		id: 123,
		name: "Test",
		full_name: "Test/Test",
		owner: { login: "test" },
		html_url: "https://test",
		updated_at: "1234"
	};

	const TASK: Task = { task: "branch", repositoryId: 123, repository: TEST_REPO };

	beforeEach(async () => {
		const res = await new DatabaseStateCreator()
			.withActiveRepoSyncState()
			.repoSyncStatePendingForBranches()
			.repoSyncStatePendingForCommits()
			.create();
		repoSyncState = res.repoSyncState!;
		subscription = res.subscription;

		TASK.repositoryId = repoSyncState.repoId;

		MESSAGE_PAYLOAD = { installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost };
		MESSAGE_PAYLOAD_GHE = {
			installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID,
			jiraHost,
			gitHubAppConfig: {
				gitHubAppId: GITHUB_APP_ID,
				appId: 2,
				clientId: "client_id",
				gitHubBaseUrl: "http://ghes.server",
				gitHubApiUrl: "http://ghes.server",
				uuid: UUID()
			}
		};
	});

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	const sentry: Hub = { setUser: jest.fn() } as Hub;

	describe("isRetryableWithSmallerRequest()", () => {

		it("should return false for error without isRetryable flag", () => {
			const err = {
				errors: [
					{
						type: "FOO"
					}
				]
			};

			expect(isRetryableWithSmallerRequest(err)).toBeFalsy();
		});

		it("should return true for error with isRetryable flag", () => {
			const err = {
				isRetryable: true,
				errors: [
					{
						type: "FOO"
					}
				]
			};

			expect(isRetryableWithSmallerRequest(err)).toBeTruthy();
		});
	});

	describe("processInstallation", () => {

		it("should process the installation with deduplication for cloud", async () => {
			await processInstallation(jest.fn())(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			expect(mockedExecuteWithDeduplication.mock.calls.length).toBe(1);
			expect(mockedExecuteWithDeduplication).toBeCalledWith(`i-${DatabaseStateCreator.GITHUB_INSTALLATION_ID}-${jiraHost}-ghaid-cloud`, expect.anything());
		});

		it("should process the installation with deduplication for GHES", async () => {
			const sendSqsMessage = jest.fn();
			await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD_GHE, sentry, TEST_LOGGER);
			expect(mockedExecuteWithDeduplication.mock.calls.length).toBe(1);
			expect(mockedExecuteWithDeduplication).toBeCalledWith(`i-${DatabaseStateCreator.GITHUB_INSTALLATION_ID}-${jiraHost}-ghaid-${GITHUB_APP_ID}`, expect.anything());
		});

		it("should reschedule the job if deduplicator is unsure", async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER);
			const sendSqsMessage = jest.fn();
			await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			expect(sendSqsMessage).toBeCalledTimes(1);
			expect(sendSqsMessage).toBeCalledWith(MESSAGE_PAYLOAD, 60, expect.anything());
		});

		it("should also reschedule the job if deduplicator is sure", async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB);
			const sendSqsMessage = jest.fn();
			await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			expect(sendSqsMessage).toBeCalledTimes(1);
		});

		it("should rethrow errors", async () => {
			mockedExecuteWithDeduplication.mockRejectedValue(new Error(":haha:"));
			const sendSqsMessage = jest.fn();
			let err;
			try {
				await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			} catch (caught) {
				err = caught;
			}
			expect(err.message).toEqual(":haha:");
		});

		it("should mark subscription as successful when no other tasks left", async () => {
			await repoSyncState.destroy();
			const sendSqsMessage = jest.fn();

			await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			await mockedExecuteWithDeduplication.mock.calls[0][1]();

			expect((await Subscription.findByPk(subscription.id)).syncStatus).toEqual(SyncStatus.COMPLETE);
		});

		it("should update cursor and continue sync", async () => {
			const sendSqsMessage = jest.fn();
			githubUserTokenNock(DatabaseStateCreator.GITHUB_INSTALLATION_ID);
			githubNock
				.post("/graphql", branchesNoLastCursor())
				.query(true)
				.reply(200, branchNodesFixture);
			jiraNock.post("/rest/devinfo/0.10/bulk").reply(200);

			await processInstallation(sendSqsMessage)(MESSAGE_PAYLOAD, sentry, TEST_LOGGER);
			await mockedExecuteWithDeduplication.mock.calls[0][1]();

			expect(sendSqsMessage).toBeCalledTimes(1);
		});
	});

	describe("handleBackfillError", () => {

		const scheduleNextTask = jest.fn();
		const MOCKED_TIMESTAMP_MSECS = 12_345_678;

		beforeEach(() => {
			mockSystemTime(MOCKED_TIMESTAMP_MSECS);
		});

		it("Rate limiting error will be retried with the correct delay", async () => {
			const RATE_LIMIT_RESET_TIMESTAMP_SECS = 12360;
			gheNock.get("/")
				.reply(403, {}, {
					"access-control-allow-origin": "*",
					"connection": "close",
					"content-type": "application/json; charset=utf-8",
					"date": "Fri, 04 Mar 2022 21:09:27 GMT",
					"x-ratelimit-limit": "8900",
					"x-ratelimit-remaining": "0",
					"x-ratelimit-reset": "" + RATE_LIMIT_RESET_TIMESTAMP_SECS,
					"x-ratelimit-resource": "core",
					"x-ratelimit-used": "2421"
				});

			const client = await createAnonymousClient(gheUrl, jiraHost, getLogger("test"));
			try {
				await client.getMainPage(1000);
			} catch (err) {
				await handleBackfillError(err, MESSAGE_PAYLOAD, TASK, TEST_LOGGER, scheduleNextTask);
			}

			expect(scheduleNextTask).toBeCalledWith(MESSAGE_PAYLOAD, (RATE_LIMIT_RESET_TIMESTAMP_SECS * 1000 - MOCKED_TIMESTAMP_MSECS) / 1000, expect.anything());
			expect((await RepoSyncState.findByPk(repoSyncState.id)!).status).toEqual("pending");
		});

		it("No delay if rate limit already reset", async () => {
			const axiosResponse = {
				data: "Rate Limit",
				status: 403,
				statusText: "RateLimit",
				headers: {
					"x-ratelimit-reset": "12345",
					"x-ratelimit-remaining": "0"
				},
				config: {}
			};

			await handleBackfillError(new GithubClientRateLimitingError({
				response: axiosResponse
			} as unknown as AxiosError), MESSAGE_PAYLOAD, TASK, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toBeCalledWith(MESSAGE_PAYLOAD, 0, expect.anything());
			expect((await RepoSyncState.findByPk(repoSyncState.id)!).status).toEqual("pending");
		});

		it("Task ignored if not found error", async () => {
			gheNock.get("/")
				.reply(404, {});

			const client = await createAnonymousClient(gheUrl, jiraHost, getLogger("test"));
			try {
				await client.getMainPage(1000);
			} catch (err) {
				await handleBackfillError(err, MESSAGE_PAYLOAD, TASK, TEST_LOGGER, scheduleNextTask);
			}

			expect(scheduleNextTask).toHaveBeenCalledTimes(1);
			expect((await RepoSyncState.findByPk(repoSyncState.id)!).branchStatus).toEqual("complete");
		});

		it("Repository ignored if not found error", async () => {
			await handleBackfillError(new GithubNotFoundError({ } as AxiosError), MESSAGE_PAYLOAD, TASK, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledTimes(1);
			expect((await RepoSyncState.findByPk(repoSyncState.id)!).branchStatus).toEqual("complete");
		});

		it("rethrows unknown error", async () => {
			const connectionRefusedError = new ConnectionTimedOutError(new Error("foo"));

			let err;
			try {
				await handleBackfillError(connectionRefusedError, MESSAGE_PAYLOAD, TASK, TEST_LOGGER, scheduleNextTask);
			} catch (caught) {
				err = caught;
			}
			expect(err).toBeInstanceOf(TaskError);
			expect(err.task).toEqual(TASK);
			expect(err.cause).toBeInstanceOf(ConnectionTimedOutError);
			expect((await RepoSyncState.findByPk(repoSyncState.id)!).branchStatus).toEqual("pending");
		});

		it("rethrows github error", async () => {
			const connectionRefusedError = new GithubClientError("foo", { code: "foo" } as unknown as AxiosError);

			let err;
			try {
				await handleBackfillError(connectionRefusedError, MESSAGE_PAYLOAD, TASK, TEST_LOGGER, scheduleNextTask);
			} catch (caught) {
				err = caught;
			}
			expect(err).toBeInstanceOf(TaskError);
			expect(err.task).toEqual(TASK);
			expect(err.cause).toBeInstanceOf(GithubClientError);
			expect((await RepoSyncState.findByPk(repoSyncState.id)!).branchStatus).toEqual("pending");
		});

	});

	describe("getTargetTasks", () => {
		it("should return all tasks if no target tasks present", async () => {
			expect(getTargetTasks()).toEqual(["pull", "branch", "commit", "build", "deployment"]);
			expect(getTargetTasks([])).toEqual(["pull", "branch", "commit", "build", "deployment"]);
		});

		it("should return single target task", async () => {
			expect(getTargetTasks(["pull"])).toEqual(["pull"]);
		});

		it("should return set of target tasks", async () => {
			expect(getTargetTasks(["pull", "commit"])).toEqual(["pull", "commit"]);
		});

		it("should return set of target tasks and filter out invalid values", async () => {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			expect(getTargetTasks(["pull", "commit", "cats"])).toEqual(["pull", "commit"]);
		});
	});

	describe("markCurrentTaskAsFailedAndContinue", () => {
		it("does nothing when there's no subscription", async () => {
			const sendMessageMock = jest.fn();
			await markCurrentTaskAsFailedAndContinue({
				...MESSAGE_PAYLOAD,
				installationId: MESSAGE_PAYLOAD.installationId + 1
			}, TASK, false, sendMessageMock, getLogger("test"));

			const refreshedRepoSyncState = await RepoSyncState.findByPk(repoSyncState.id);
			const refreshedSubscription = await Subscription.findByPk(subscription.id);
			expect(repoSyncState.get({ plain: true })).toStrictEqual(refreshedRepoSyncState.get({ plain: true }));
			expect(refreshedSubscription.get({ plain: true })).toStrictEqual(subscription.get({ plain: true }));
			expect(sendMessageMock).toBeCalledTimes(0);
		});

		it("updates status in RepoSyncState table", async () => {
			await markCurrentTaskAsFailedAndContinue(MESSAGE_PAYLOAD, TASK, false, jest.fn(), getLogger("test"));

			const refreshedRepoSyncState = await RepoSyncState.findByPk(repoSyncState.id);
			const refreshedSubscription = await Subscription.findByPk(subscription.id);
			expect(refreshedRepoSyncState.branchStatus).toEqual("failed");
			expect(refreshedSubscription.get({ plain: true })).toStrictEqual(subscription.get({ plain: true }));
		});

		it("does not update cursor in RepoSyncState table", async () => {
			await markCurrentTaskAsFailedAndContinue(MESSAGE_PAYLOAD, TASK, false, jest.fn(), getLogger("test"));

			const refreshedRepoSyncState = await RepoSyncState.findByPk(repoSyncState.id);
			expect(refreshedRepoSyncState.branchCursor).toEqual(repoSyncState.branchCursor);
		});

		it("schedules next message", async () => {
			const sendMessageMock = jest.fn();
			await markCurrentTaskAsFailedAndContinue(MESSAGE_PAYLOAD, TASK, false, sendMessageMock, getLogger("test"));

			expect(sendMessageMock).toBeCalledTimes(1);
		});

		it("sets up sync warning on permission error", async () => {
			const sendMessageMock = jest.fn();
			await markCurrentTaskAsFailedAndContinue(MESSAGE_PAYLOAD, TASK, true, sendMessageMock, getLogger("test"));

			const refreshedSubscription = await Subscription.findByPk(subscription.id);
			expect(refreshedSubscription.syncWarning).toEqual("Invalid permissions for branch task");
		});
	});

	describe("updateTaskStatusAndContinue", () => {
		const GITHUB_INSTALLATION_ID = 1111;
		const REPO_ID = 12345;
		const commitsFromDate = new Date();
		let data: BackfillMessagePayload;
		let sub: Subscription;
		let repoSync: RepoSyncState;
		beforeEach(async ()=> {
			sub = await Subscription.install({ host: jiraHost, installationId: GITHUB_INSTALLATION_ID, gitHubAppId: undefined, hashedClientKey: "client-key" });
			repoSync = await RepoSyncState.create({
				subscriptionId: sub.id, repoId: REPO_ID, repoName: "name", repoUrl: "url", repoOwner: "owner", repoFullName: "full name",
				repoPushedAt: new Date(), repoUpdatedAt: new Date(), repoCreatedAt: new Date()
			});
			data = {
				installationId: GITHUB_INSTALLATION_ID,
				jiraHost: jiraHost,
				commitsFromDate: commitsFromDate.toISOString()
			};
		});

		it("should skip update backfill from date if task is branch", async () => {
			await updateTaskStatusAndContinue(data, { edges: [], jiraPayload: undefined }, "branch", REPO_ID, getLogger("test"), jest.fn());
			await repoSync.reload();
			expect(repoSync.branchFrom).toBeNull();
		});

		it("should skip update backfill from date if task is repository", async () => {
			await updateTaskStatusAndContinue(data, { edges: [], jiraPayload: undefined }, "repository", REPO_ID, getLogger("test"), jest.fn());
			await repoSync.reload();
			expect(repoSync.branchFrom).toBeNull();
			expect(repoSync.commitFrom).toBeNull();
			expect(repoSync.pullFrom).toBeNull();
			expect(repoSync.buildFrom).toBeNull();
			expect(repoSync.deploymentFrom).toBeNull();
		});

		describe.each(["pull", "commit", "build", "deployment"] as TaskType[])("Update jobs status for each tasks", (task: TaskType) => {
			const colTaskFrom = `${task}From`;
			it(`${task}: should update backfill from date upon success complete and existing backfill date is empty`, async () => {
				await updateTaskStatusAndContinue(data, { edges: [], jiraPayload: undefined }, task, REPO_ID, getLogger("test"), jest.fn());
				await repoSync.reload();
				expect(repoSync[colTaskFrom]!.toISOString()).toEqual(commitsFromDate.toISOString());
			});
			it(`${task}: should update backfill from date upon success complete and new backfill date is earlier`, async () => {
				repoSync.pullFrom = new Date(commitsFromDate.getTime() + 100000);
				await repoSync.save();
				await updateTaskStatusAndContinue(data, { edges: [], jiraPayload: undefined }, task, REPO_ID, getLogger("test"), jest.fn());
				await repoSync.reload();
				expect(repoSync[colTaskFrom]!.toISOString()).toEqual(commitsFromDate.toISOString());
			});
			it(`${task}: should skip update backfill from date upon success complete and new backfill date is more recent`, async () => {
				const oldDate = new Date(commitsFromDate.getTime() - 100000);
				repoSync[colTaskFrom]= oldDate;
				await repoSync.save();
				await updateTaskStatusAndContinue(data, { edges: [], jiraPayload: undefined }, task, REPO_ID, getLogger("test"), jest.fn());
				await repoSync.reload();
				expect(repoSync[colTaskFrom]!.toISOString()).toEqual(oldDate.toISOString());
			});
			it(`${task}: should not update backfill from date is job is not complete`, async () => {
				await updateTaskStatusAndContinue(data, { edges: [ { cursor: "abcd" } ], jiraPayload: undefined }, "pull", REPO_ID, getLogger("test"), jest.fn());
				await repoSync.reload();
				expect(repoSync.pullFrom).toBeNull();
			});
		});
	});

});
