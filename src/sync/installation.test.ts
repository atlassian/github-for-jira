/* eslint-disable @typescript-eslint/no-explicit-any */
import * as installation from "~/src/sync/installation";
import {
	getTargetTasks,
	handleBackfillError,
	isNotFoundError,
	isRetryableWithSmallerRequest,
	maybeScheduleNextTask,
	processInstallation,
	sortedRepos
} from "~/src/sync/installation";
import { DeduplicatorResult } from "~/src/sync/deduplicator";
import { Application } from "probot";
import { getLogger } from "config/logger";
import { sqsQueues } from "~/src/sqs/queues";
import { Hub } from "@sentry/types/dist/hub";
import { mocked } from "ts-jest/utils";
import { RateLimitingError } from "~/src/github/client/github-client-errors";
import { Subscription, Repository } from "models/subscription";
import { mockNotFoundErrorOctokitGraphql, mockNotFoundErrorOctokitRequest, mockOtherError, mockOtherOctokitGraphqlErrors, mockOtherOctokitRequestErrors } from "test/mocks/error-responses";
import unsortedReposJson from "fixtures/repositories.json";
import sortedReposJson from "fixtures/sorted-repos.json";
import { when } from "jest-when";
import { stringFlag, StringFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

const TEST_LOGGER = getLogger("test");

jest.mock("../sqs/queues");
const mockedExecuteWithDeduplication = jest.fn();
jest.mock("~/src/sync/deduplicator", () => ({
	...jest.requireActual("~/src/sync/deduplicator"),
	Deduplicator: function() {
		return { executeWithDeduplication: mockedExecuteWithDeduplication };
	}
}));

describe("sync/installation", () => {

	const JOB_DATA = { installationId: 1, jiraHost: "http://foo" };

	const TEST_REPO: Repository = {
		id: 123,
		name: "Test",
		full_name: "Test/Test",
		owner: { login: "test" },
		html_url: "https://test",
		updated_at: "1234"
	};

	const TASK: installation.Task = { task: "commit", repositoryId: 123, repository: TEST_REPO };

	const TEST_SUBSCRIPTION: Subscription = {} as any;

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	const sentry: Hub = { setUser: jest.fn() } as Hub;

	let mockBackfillQueueSendMessage;

	beforeEach(() => {
		mockBackfillQueueSendMessage = mocked(sqsQueues.backfill.sendMessage);
	});

	describe("isRetryableWithSmallerRequest()", () => {

		it("should return true for max node limit exceeded", async () => {
			const err = {
				errors: [
					{
						type: "MAX_NODE_LIMIT_EXCEEDED"
					}
				]
			};

			expect(await isRetryableWithSmallerRequest(err)).toBeTruthy();
		});

		it("should return true for 'something went wrong' error", async () => {
			const err = {
				errors: [
					{
						message: "Something went wrong while executing your query. some random text"
					}
				]
			};

			expect(await isRetryableWithSmallerRequest(err)).toBeTruthy();
		});

		it("should return false for unknown error", async () => {
			const err = {
				errors: [
					{
						type: "FOO"
					}
				]
			};

			expect(await isRetryableWithSmallerRequest(err)).toBeFalsy();
		});
	});

	describe("processInstallation", () => {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const app: Application = jest.fn() as Application;

		it("should process the installation with deduplication", async () => {
			await processInstallation(app)(JOB_DATA, sentry, TEST_LOGGER);
			expect(mockedExecuteWithDeduplication.mock.calls.length).toBe(1);
		});

		it("should reschedule the job if deduplicator is unsure", async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER);
			await processInstallation(app)(JOB_DATA, sentry, TEST_LOGGER);
			expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
			expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(JOB_DATA);
			expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(60);
			expect(mockBackfillQueueSendMessage.mock.calls[0][2].warn).toBeDefined();
		});

		it("should also reschedule the job if deduplicator is sure", async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB);
			await processInstallation(app)(JOB_DATA, sentry, TEST_LOGGER);
			expect(mockBackfillQueueSendMessage.mock.calls.length).toEqual(1);
		});
	});

	describe("maybeScheduleNextTask", () => {
		it("does nothing if there is no next task", () => {
			maybeScheduleNextTask(JOB_DATA, [], TEST_LOGGER);
			expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(0);
		});

		it("when multiple tasks, picks the one with the highest delay", async () => {
			await maybeScheduleNextTask(JOB_DATA, [30_000, 60_000, 0], TEST_LOGGER);
			expect(mockBackfillQueueSendMessage.mock.calls).toEqual([[JOB_DATA, 60, TEST_LOGGER]]);
		});

		it("not passing delay to queue when not provided", async () => {
			await maybeScheduleNextTask(JOB_DATA, [0], TEST_LOGGER);
			expect(mockBackfillQueueSendMessage.mock.calls).toEqual([[JOB_DATA, 0, TEST_LOGGER]]);
		});
	});

	describe("handleBackfillError", () => {

		const scheduleNextTask = jest.fn();
		let updateStatusSpy;
		let failRepoSpy;

		beforeEach(() => {

			updateStatusSpy = jest.spyOn(installation, "updateJobStatus");
			failRepoSpy = jest.spyOn(installation, "markCurrentRepositoryAsFailedAndContinue");

			updateStatusSpy.mockReturnValue(Promise.resolve());
			failRepoSpy.mockReturnValue(Promise.resolve());

			mockSystemTime(12345678);
		});

		it("Rate limiting error will be retried with the correct delay", () => {
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

			handleBackfillError(new RateLimitingError(axiosResponse), JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toBeCalledWith(14322);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);

		});

		it("No delay if rate limit already reset", () => {
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

			handleBackfillError(new RateLimitingError(axiosResponse), JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toBeCalledWith(0);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);

		});

		it("Error with headers indicating rate limit will be retryed with the appropriate delay", () => {
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

			handleBackfillError(probablyRateLimitError, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toBeCalledWith(14322);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);

		});


		it("Repository ignored if not found error", () => {
			const notFoundError = {
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
				name: "HttpError",
				status: 404
			};

			handleBackfillError(notFoundError, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledTimes(0);
			expect(updateStatusSpy).toHaveBeenCalledTimes(1);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("Repository ignored if GraphQL not found error", () => {

			handleBackfillError(mockNotFoundErrorOctokitGraphql, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledTimes(0);
			expect(updateStatusSpy).toHaveBeenCalledTimes(1);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("Repository failed if some kind of unknown error", () => {


			handleBackfillError(mockOtherOctokitRequestErrors, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledTimes(0);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(1);
		});

		it("60s delay if abuse detection triggered", () => {
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

			handleBackfillError(abuseDetectionError, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledWith(60_000);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

		it("5s delay if connection timeout", () => {
			const connectionTimeoutErr = "connect ETIMEDOUT";

			handleBackfillError(connectionTimeoutErr, JOB_DATA, TASK, TEST_SUBSCRIPTION, TEST_LOGGER, scheduleNextTask);
			expect(scheduleNextTask).toHaveBeenCalledWith(5_000);
			expect(updateStatusSpy).toHaveBeenCalledTimes(0);
			expect(failRepoSpy).toHaveBeenCalledTimes(0);
		});

	});

	it("sortedRepos should sort repos by updated_at", () => {
		expect(sortedRepos(unsortedReposJson as any)).toEqual(sortedReposJson);
	});

	describe("handleNotFoundErrors", () => {
		it("should continue sync if 404 status is sent in response from octokit/request", (): void => {
			// returns true if status is 404 so sync will continue
			expect(
				isNotFoundError(
					mockNotFoundErrorOctokitRequest,
					getLogger("test")
				)
			).toBeTruthy();
		});

		it("should continue sync if NOT FOUND error is sent in response from octokit/graphql", (): void => {
			// returns true if error object has type 'NOT_FOUND' so sync will continue
			expect(
				isNotFoundError(
					mockNotFoundErrorOctokitGraphql,
					getLogger("test")
				)
			).toBeTruthy();
		});

		it("handleNotFoundErrors should not continue sync for any other error response type", () => {
			expect(
				isNotFoundError(
					mockOtherOctokitRequestErrors,
					getLogger("test")
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					mockOtherOctokitGraphqlErrors,
					getLogger("test")
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					mockOtherError,
					getLogger("test")
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					null,
					getLogger("test")
				)
			).toBeFalsy();

			expect(
				isNotFoundError(
					"",
					getLogger("test")
				)
			).toBeFalsy();
		});
	});

	describe("getTargetTasks", () => {
		const jiraHost = "not-a-real-jirahost";
		const DEFAULT_BACKFILL_FLAG = "pull,branch,commit,build,deployment";

		describe("Default feature flag", () => {

			beforeEach(() => {
				when(stringFlag).calledWith(
					StringFlags.TARGET_BACKFILL_TASKS,
					expect.anything(),
					expect.anything()
				).mockResolvedValue(DEFAULT_BACKFILL_FLAG);
			});

			it("should return all tasks if no feature flag or target tasks present", async () => {
				return getTargetTasks(jiraHost).then((tasks) => {
					expect(tasks).toEqual(["pull", "branch", "commit", "build", "deployment"]);
				});
			});

			it("should return single target tasks with deafult feature flag", async () => {
				return getTargetTasks(jiraHost, ["pull"]).then((tasks) => {
					expect(tasks).toEqual(["pull"]);
				});
			});

			it("should return set of target tasks with default feature flag", async () => {
				return getTargetTasks(jiraHost, ["pull", "commit"]).then((tasks) => {
					expect(tasks).toEqual(["pull", "commit"]);
				});
			});
		});

		describe("Variable feature flag", () => {

			it("should return single task from feature flag", async () => {
				when(stringFlag).calledWith(
					StringFlags.TARGET_BACKFILL_TASKS,
					expect.anything(),
					expect.anything()
				).mockResolvedValue("build");
				return getTargetTasks(jiraHost).then((tasks) => {
					expect(tasks).toEqual(["build"]);
				});
			});
			it("should return subset of tasks from feature flag", async () => {
				when(stringFlag).calledWith(
					StringFlags.TARGET_BACKFILL_TASKS,
					expect.anything(),
					expect.anything()
				).mockResolvedValue("branch,commit");

				return getTargetTasks(jiraHost).then((tasks) => {
					expect(tasks).toEqual(["branch", "commit"]);
				});
			});
		});

	});


});
