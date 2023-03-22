/* eslint-disable @typescript-eslint/no-explicit-any */
import * as installation from "~/src/sync/installation";
import {
	getTargetTasks,
	handleBackfillError,
	isRetryableWithSmallerRequest, markCurrentTaskAsFailedAndContinue,
	maybeScheduleNextTask,
	processInstallation,
	TaskError
} from "~/src/sync/installation";
import { Task } from "~/src/sync/sync.types";
import { DeduplicatorResult } from "~/src/sync/deduplicator";
import { getLogger } from "config/logger";
import { Hub } from "@sentry/types/dist/hub";
import { GithubClientGraphQLError, RateLimitingError } from "~/src/github/client/github-client-errors";
import { Repository, Subscription, SyncStatus } from "models/subscription";
import { mockNotFoundErrorOctokitGraphql } from "test/mocks/error-responses";
import { v4 as UUID } from "uuid";
import { ConnectionTimedOutError } from "sequelize";
import { AxiosError, AxiosResponse } from "axios";
import { createAnonymousClient } from "utils/get-github-client-config";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { RepoSyncState } from "models/reposyncstate";

const mockedExecuteWithDeduplication = jest.fn();
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
	});

	describe("maybeScheduleNextTask", () => {
		it("does nothing if there is no next task", async () => {
			const sendSqsMessage = jest.fn();
			await maybeScheduleNextTask(sendSqsMessage, MESSAGE_PAYLOAD, [], TEST_LOGGER);
			expect(sendSqsMessage).toBeCalledTimes(0);
		});

		it("when multiple tasks, picks the one with the highest delay", async () => {
			const sendSqsMessage = jest.fn();
			await maybeScheduleNextTask(sendSqsMessage, MESSAGE_PAYLOAD, [30_000, 60_000, 0], TEST_LOGGER);
			expect(sendSqsMessage).toBeCalledTimes(1);
			expect(sendSqsMessage).toBeCalledWith(MESSAGE_PAYLOAD, 60, expect.anything());
		});

		it("not passing delay to queue when not provided", async () => {
			const sendSqsMessage = jest.fn();
			await maybeScheduleNextTask(sendSqsMessage, MESSAGE_PAYLOAD, [0], TEST_LOGGER);
			expect(sendSqsMessage).toBeCalledWith(MESSAGE_PAYLOAD, 0, expect.anything());
		});
	});

	describe("handleBackfillError", () => {

		const scheduleNextTask = jest.fn();
		let failRepoSpy;

		beforeEach(() => {

			failRepoSpy = jest.spyOn(installation, "markCurrentTaskAsFailedAndContinue");

			failRepoSpy.mockReturnValue(Promise.resolve());

			mockSystemTime(12345678);
		});

		it("Rate limiting error will be retried with the correct delay", async () => {
			const axiosResponse = {
				data: "Rate Limit",
				status: 403,
				statusText: "RateLimit",
				headers: {
					"x-ratelimit-reset": "12360",
					"x-ratelimit-remaining": "0"
				},
				config: {}
			};

			await handleBackfillError(
				new RateLimitingError(
					{ response: axiosResponse } as unknown as AxiosError
				),
				MESSAGE_PAYLOAD, TASK, TEST_LOGGER, scheduleNextTask
			);

			expect(scheduleNextTask).toBeCalledWith(14322);
			expect((await RepoSyncState.findByPk(repoSyncState.id)!).status).toEqual("pending");
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
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

			await handleBackfillError(new RateLimitingError({
				response: axiosResponse
			} as unknown as AxiosError), MESSAGE_PAYLOAD, TASK, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toBeCalledWith(0);
			expect((await RepoSyncState.findByPk(repoSyncState.id)!).status).toEqual("pending");
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("Error with headers indicating rate limit will be retried with the appropriate delay", async () => {
			gheNock.get("/")
				.reply(403, {}, {
					"access-control-allow-origin": "*",
					"connection": "close",
					"content-type": "application/json; charset=utf-8",
					"date": "Fri, 04 Mar 2022 21:09:27 GMT",
					"x-ratelimit-limit": "8900",
					"x-ratelimit-remaining": "0",
					"x-ratelimit-reset": "12360",
					"x-ratelimit-resource": "core",
					"x-ratelimit-used": "2421"
				});

			const client = await createAnonymousClient(gheUrl, jiraHost, getLogger("test"));
			try {
				await client.getMainPage(1000);
			} catch (err) {
				await handleBackfillError(err, MESSAGE_PAYLOAD, TASK, TEST_LOGGER, scheduleNextTask);
			}
			expect(scheduleNextTask).toBeCalledWith(14322);
			expect((await RepoSyncState.findByPk(repoSyncState.id)!).status).toEqual("pending");
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
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
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("Repository ignored if GraphQL not found error", async () => {
			await handleBackfillError(new GithubClientGraphQLError({ } as AxiosResponse, mockNotFoundErrorOctokitGraphql.errors), MESSAGE_PAYLOAD, TASK, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledTimes(1);
			expect((await RepoSyncState.findByPk(repoSyncState.id)!).branchStatus).toEqual("complete");
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
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
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
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

});
