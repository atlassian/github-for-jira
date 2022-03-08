import {
	handleBackfillError,
	isRetryableWithSmallerRequest,
	maybeScheduleNextTask,
	processInstallation
} from "../../../src/sync/installation";

import {DeduplicatorResult} from "../../../src/sync/deduplicator";

import "../../../src/config/feature-flags";

import {Application} from "probot";
import {getLogger} from "../../../src/config/logger";
import {sqsQueues} from "../../../src/sqs/queues";
import {Hub} from "@sentry/types/dist/hub";
import {mocked} from "ts-jest/utils";
import {RateLimitingError} from "../../../src/github/client/errors";
import {mockNotFoundErrorOctokitGraphql, mockOtherOctokitRequestErrors} from "../../mocks/errorResponses";

const TEST_LOGGER = getLogger("test");

jest.mock("../../../src/sqs/queues");
jest.mock("../../../src/models");
const mockedExecuteWithDeduplication = jest.fn();
jest.mock("../../../src/sync/deduplicator", () => ({
	...jest.requireActual("../../../src/sync/deduplicator"),
	Deduplicator: function() {
		return { executeWithDeduplication: mockedExecuteWithDeduplication };
	}
}));

describe("sync/installation", () => {

	const JOB_DATA = { installationId: 1, jiraHost: "http://foo" };

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

			expect(isRetryableWithSmallerRequest(err)).toBeTruthy();
		});

		it("should return true for 'something went wrong' error", async () => {
			const err = {
				errors: [
					{
						message: "Something went wrong while executing your query. some random text"
					}
				]
			};

			expect(isRetryableWithSmallerRequest(err)).toBeTruthy();
		});

		it("should return false for unknown error", async () => {
			const err = {
				errors: [
					{
						type: "FOO"
					}
				]
			};

			expect(isRetryableWithSmallerRequest(err)).toBeFalsy();
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
		const ignoreCurrentRepo = jest.fn();
		const failCurrentRepo = jest.fn();

		beforeEach(() => {
			ignoreCurrentRepo.mockReturnValue(Promise.resolve());
			failCurrentRepo.mockReturnValue(Promise.resolve());

			mockSystemTime(12345678);
		})

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

			handleBackfillError(new RateLimitingError(axiosResponse), TEST_LOGGER, scheduleNextTask, ignoreCurrentRepo, failCurrentRepo);
			expect(scheduleNextTask).toBeCalledWith(14322);
			expect(ignoreCurrentRepo).toHaveBeenCalledTimes(0);
			expect(failCurrentRepo).toHaveBeenCalledTimes(0);

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

			handleBackfillError(new RateLimitingError(axiosResponse), TEST_LOGGER, scheduleNextTask, ignoreCurrentRepo, failCurrentRepo);
			expect(scheduleNextTask).toBeCalledWith(0);
			expect(ignoreCurrentRepo).toHaveBeenCalledTimes(0);
			expect(failCurrentRepo).toHaveBeenCalledTimes(0);

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
					"x-ratelimit-used": "2421",
				},
				name: "HttpError",
				status: 403
			}

			handleBackfillError(probablyRateLimitError, TEST_LOGGER, scheduleNextTask, ignoreCurrentRepo, failCurrentRepo);
			expect(scheduleNextTask).toBeCalledWith(14322);
			expect(ignoreCurrentRepo).toHaveBeenCalledTimes(0);
			expect(failCurrentRepo).toHaveBeenCalledTimes(0);

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
					"x-ratelimit-used": "2421",
				},
				name: "HttpError",
				status: 404
			}

			handleBackfillError(notFoundError, TEST_LOGGER, scheduleNextTask, ignoreCurrentRepo, failCurrentRepo);
			expect(scheduleNextTask).toHaveBeenCalledTimes(0);
			expect(ignoreCurrentRepo).toHaveBeenCalledTimes(1);
			expect(failCurrentRepo).toHaveBeenCalledTimes(0);
		});

		it("Repository ignored if GraphQL not found error", () => {

			handleBackfillError(mockNotFoundErrorOctokitGraphql, TEST_LOGGER, scheduleNextTask, ignoreCurrentRepo, failCurrentRepo);
			expect(scheduleNextTask).toHaveBeenCalledTimes(0);
			expect(ignoreCurrentRepo).toHaveBeenCalledTimes(1);
			expect(failCurrentRepo).toHaveBeenCalledTimes(0);
		});

		it("Repository failed if some kind of unknown error", () => {


			handleBackfillError(mockOtherOctokitRequestErrors, TEST_LOGGER, scheduleNextTask, ignoreCurrentRepo, failCurrentRepo);
			expect(scheduleNextTask).toHaveBeenCalledTimes(0);
			expect(ignoreCurrentRepo).toHaveBeenCalledTimes(0);
			expect(failCurrentRepo).toHaveBeenCalledTimes(1);
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
					"x-ratelimit-used": "2421",
				},
				message: "You have triggered an abuse detection mechanism",
				name: "HttpError",
				status: 403
			}

			handleBackfillError(abuseDetectionError, TEST_LOGGER, scheduleNextTask, ignoreCurrentRepo, failCurrentRepo);
			expect(scheduleNextTask).toHaveBeenCalledWith(60_000);
			expect(ignoreCurrentRepo).toHaveBeenCalledTimes(0);
			expect(failCurrentRepo).toHaveBeenCalledTimes(0);
		});

		it("5s delay if connection timeout", () => {
			const connectionTimeoutErr = "connect ETIMEDOUT";

			handleBackfillError(connectionTimeoutErr, TEST_LOGGER, scheduleNextTask, ignoreCurrentRepo, failCurrentRepo);
			expect(scheduleNextTask).toHaveBeenCalledWith(5_000);
			expect(ignoreCurrentRepo).toHaveBeenCalledTimes(0);
			expect(failCurrentRepo).toHaveBeenCalledTimes(0);
		});

	});

});
