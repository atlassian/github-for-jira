/* eslint-disable @typescript-eslint/no-explicit-any */
import * as installation from "~/src/sync/installation";
import { getTargetTasks, handleBackfillError, isRetryableWithSmallerRequest, maybeScheduleNextTask, processInstallation } from "~/src/sync/installation";
import { Task } from "~/src/sync/sync.types";
import { DeduplicatorResult } from "~/src/sync/deduplicator";
import { getLogger } from "config/logger";
import { sqsQueues } from "~/src/sqs/queues";
import { Hub } from "@sentry/types/dist/hub";
import { GithubClientGraphQLError, RateLimitingError } from "~/src/github/client/github-client-errors";
import { Repository, Subscription } from "models/subscription";
import { mockNotFoundErrorOctokitGraphql, mockOtherOctokitRequestErrors } from "test/mocks/error-responses";
import { v4 as UUID } from "uuid";
import { ConnectionTimedOutError, Sequelize } from "sequelize";
import { AxiosError, AxiosResponse } from "axios";
import { createAnonymousClient } from "utils/get-github-client-config";

jest.mock("../sqs/queues");
const mockedExecuteWithDeduplication = jest.fn();
jest.mock("~/src/sync/deduplicator", () => ({
	...jest.requireActual("~/src/sync/deduplicator"),
	Deduplicator: function() {
		return { executeWithDeduplication: mockedExecuteWithDeduplication };
	}
}));

describe("sync/installation", () => {

	const TEST_LOGGER = getLogger("test");
	const JOB_DATA = { installationId: 1, jiraHost: "http://foo" };
	const GITHUB_APP_ID = 123;
	const JOB_DATA_GHES = {
		installationId: 1,
		jiraHost: "http://foo-ghes",
		gitHubAppConfig: {
			gitHubAppId: GITHUB_APP_ID,
			appId: 2,
			clientId: "client_id",
			gitHubBaseUrl: "http://ghes.server",
			gitHubApiUrl: "http://ghes.server",
			uuid: UUID()
		}
	};

	const TEST_REPO: Repository = {
		id: 123,
		name: "Test",
		full_name: "Test/Test",
		owner: { login: "test" },
		html_url: "https://test",
		updated_at: "1234"
	};

	const TASK: Task = { task: "commit", repositoryId: 123, repository: TEST_REPO, taskStartTimeInMS: new Date().getTime() };

	const TEST_SUBSCRIPTION: Subscription = {} as any;

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
			await processInstallation()(JOB_DATA, sentry, TEST_LOGGER);
			expect(mockedExecuteWithDeduplication.mock.calls.length).toBe(1);
			expect(mockedExecuteWithDeduplication).toBeCalledWith(`i-1-http://foo-ghaid-cloud`, expect.anything());
		});

		it("should process the installation with deduplication for GHES", async () => {
			await processInstallation()(JOB_DATA_GHES, sentry, TEST_LOGGER);
			expect(mockedExecuteWithDeduplication.mock.calls.length).toBe(1);
			expect(mockedExecuteWithDeduplication).toBeCalledWith(`i-1-http://foo-ghes-ghaid-${GITHUB_APP_ID}`, expect.anything());
		});

		it("should reschedule the job if deduplicator is unsure", async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER);
			await processInstallation()(JOB_DATA, sentry, TEST_LOGGER);
			expect(sqsQueues.backfill.sendMessage).toBeCalledTimes(1);
			expect(sqsQueues.backfill.sendMessage).toBeCalledWith(JOB_DATA, 60, expect.anything());
		});

		it("should also reschedule the job if deduplicator is sure", async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB);
			await processInstallation()(JOB_DATA, sentry, TEST_LOGGER);
			expect(sqsQueues.backfill.sendMessage).toBeCalledTimes(1);
		});
	});

	describe("maybeScheduleNextTask", () => {
		it("does nothing if there is no next task", async () => {
			await maybeScheduleNextTask(JOB_DATA, [], TEST_LOGGER);
			expect(sqsQueues.backfill.sendMessage).toBeCalledTimes(0);
		});

		it("when multiple tasks, picks the one with the highest delay", async () => {
			await maybeScheduleNextTask(JOB_DATA, [30_000, 60_000, 0], TEST_LOGGER);
			expect(sqsQueues.backfill.sendMessage).toBeCalledTimes(1);
			expect(sqsQueues.backfill.sendMessage).toBeCalledWith(JOB_DATA, 60, expect.anything());
		});

		it("not passing delay to queue when not provided", async () => {
			await maybeScheduleNextTask(JOB_DATA, [0], TEST_LOGGER);
			expect(sqsQueues.backfill.sendMessage).toBeCalledWith(JOB_DATA, 0, expect.anything());
		});
	});

	describe("handleBackfillError", () => {

		const scheduleNextTask = jest.fn();
		let updateStatusSpy;
		let failRepoSpy;

		beforeEach(() => {

			updateStatusSpy = jest.spyOn(installation, "updateJobStatus");
			failRepoSpy = jest.spyOn(installation, "markCurrentTaskAsFailedAndContinue");

			updateStatusSpy.mockReturnValue(Promise.resolve());
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
				JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask
			);

			expect(scheduleNextTask).toBeCalledWith(14322);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
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
			} as unknown as AxiosError), JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toBeCalledWith(0);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("Error with headers indicating rate limit will be retried with the appropriate delay", async () => {
			const probablyRateLimitError = {
				...new Error(),
				documentation_url: "https://docs.github.com/rest/reference/pulls#list-pull-requests",
				headers: {
					"access-control-allow-origin": "*",
					"connection": "close",
					"content-type": "application/json; charset=utf-8",
					"date": "Fri, 04 Mar 2022 21:09:27 GMT",
					"x-ratelimit-limit": "8900",
					"x-ratelimit-remaining": "0",
					"x-ratelimit-reset": "12360",
					"x-ratelimit-resource": "core",
					"x-ratelimit-used": "2421"
				},
				name: "HttpError",
				status: 403
			};

			await handleBackfillError(probablyRateLimitError, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toBeCalledWith(14322);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("Repository ignored if not found error", async () => {
			gheNock.get("/")
				.reply(404, {});

			const client = await createAnonymousClient(gheUrl, jiraHost, getLogger("test"));
			try {
				await client.getMainPage(1000);
			} catch (err) {
				await handleBackfillError(err, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			}

			expect(scheduleNextTask).toHaveBeenCalledTimes(0);
			expect(updateStatusSpy).toHaveBeenCalledTimes(1);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("Repository ignored if GraphQL not found error", async () => {

			await handleBackfillError(new GithubClientGraphQLError({ } as AxiosResponse, mockNotFoundErrorOctokitGraphql.errors), JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledTimes(0);
			expect(updateStatusSpy).toHaveBeenCalledTimes(1);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("Repository failed if some kind of unknown error", async () => {
			await handleBackfillError(mockOtherOctokitRequestErrors, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledTimes(0);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(1);
		});

		it("60s delay if abuse detection triggered", async () => {
			const abuseDetectionError = {
				...new Error(),
				documentation_url: "https://docs.github.com/rest/reference/pulls#list-pull-requests",
				headers: {
					"access-control-allow-origin": "*",
					"connection": "close",
					"content-type": "application/json; charset=utf-8",
					"date": "Fri, 04 Mar 2022 21:09:27 GMT",
					"x-ratelimit-limit": "8900",
					"x-ratelimit-remaining": "6479",
					"x-ratelimit-reset": "12360",
					"x-ratelimit-resource": "core",
					"x-ratelimit-used": "2421"
				},
				message: "You have triggered an abuse detection mechanism",
				name: "HttpError",
				status: 403
			};

			await handleBackfillError(abuseDetectionError, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledWith(60_000);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("5s delay if connection timeout", async () => {
			const connectionTimeoutErr = "connect ETIMEDOUT";

			await handleBackfillError(connectionTimeoutErr, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledWith(5_000);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("30s delay if cannot connect", async () => {
			const connectionRefusedError = "connect ECONNREFUSED 10.255.0.9:26272";

			await handleBackfillError(connectionRefusedError, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledWith(30_000);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("30s delay if cannot connect to database", async () => {
			const connectionRefusedError = new ConnectionTimedOutError(new Error("foo"));

			await handleBackfillError(connectionRefusedError, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledWith(30_000);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("30s delay when sequelize connection error", async () => {
			let sequelizeConnectionError: Error | undefined = undefined;
			try {
				const sequelize = new Sequelize({
					dialect: "postgres",
					host: "1.2.3.400",
					port: 3306,
					username: "your_username",
					password: "your_password",
					database: "your_database"
				});
				await sequelize.authenticate();
			} catch (err) {
				sequelizeConnectionError = err;
			}

			await handleBackfillError(sequelizeConnectionError, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledWith(30_000);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("don't reschedule a repository sync straight after a failed repository", async () => {
			const connectionTimeoutErr = "an error that doesnt match";
			const MOCK_REPO_TASK: Task = { task: "repository", repositoryId: 0, repository: TEST_REPO, taskStartTimeInMS: new Date().getTime() };

			await handleBackfillError(connectionTimeoutErr, JOB_DATA, MOCK_REPO_TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledTimes(0);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(1);
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

});
