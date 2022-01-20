import {
	isRetryableWithSmallerRequest,
	maybeScheduleNextTask,
	processInstallation
} from "../../../src/sync/installation";

import {DeduplicatorResult} from "../../../src/sync/deduplicator";

import "../../../src/config/feature-flags";

import {Application} from "probot";
import {getLogger} from "../../../src/config/logger";
import { sqsQueues } from "../../../src/sqs/queues";
import {Hub} from "@sentry/types/dist/hub";
import { mocked } from "ts-jest/utils";

const TEST_LOGGER = getLogger("test");

const mockedExecuteWithDeduplication = jest.fn();
jest.mock("../../../src/sync/deduplicator", () => {
	return {
		...jest.requireActual("../../../src/sync/deduplicator"),
		Deduplicator: function() {
			return { executeWithDeduplication: mockedExecuteWithDeduplication };
		}
	}
});

jest.mock("../../../src/sqs/queues");
jest.mock("../../../src/models");

describe("sync/installation", () => {

	const JOB_DATA = {installationId: 1, jiraHost: "http://foo"};

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	const sentry: Hub = { setUser: jest.fn() } as Hub;

	const mockBackfillQueueSendMessage = mocked(sqsQueues.backfill.sendMessage);

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

		test("should process the installation with deduplication", async () => {
			await processInstallation(app)(JOB_DATA, sentry, TEST_LOGGER);
			expect(mockedExecuteWithDeduplication.mock.calls.length).toBe(1);
		});

		test("should reschedule the job if deduplicator is unsure", async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER);
			await processInstallation(app)(JOB_DATA, sentry, TEST_LOGGER);
			expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(1);
			expect(mockBackfillQueueSendMessage.mock.calls[0][0]).toEqual(JOB_DATA);
			expect(mockBackfillQueueSendMessage.mock.calls[0][1]).toEqual(60);
			expect(mockBackfillQueueSendMessage.mock.calls[0][2]?.warn).toBeDefined();
		});

		test("should also reschedule the job if deduplicator is sure", async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB);
			await processInstallation(app)(JOB_DATA, sentry, TEST_LOGGER);
			expect(mockBackfillQueueSendMessage.mock.calls.length).toEqual(1);
		});
	});

	describe("maybeScheduleNextTask", () => {
		test("does nothing if there is no next task", () => {
			maybeScheduleNextTask(JOB_DATA, [], TEST_LOGGER);
			expect(mockBackfillQueueSendMessage.mock.calls).toHaveLength(0);
		});

		test("when multiple tasks, picks the one with the highest delay", async () => {
			await maybeScheduleNextTask(JOB_DATA, [30_000, 60_000, 0], TEST_LOGGER);
			expect(mockBackfillQueueSendMessage.mock.calls).toEqual([[JOB_DATA, 60, TEST_LOGGER]]);
		});

		test("not passing delay to queue when not provided", async () => {
			await maybeScheduleNextTask(JOB_DATA, [0], TEST_LOGGER);
			expect(mockBackfillQueueSendMessage.mock.calls).toEqual([[JOB_DATA, 0, TEST_LOGGER]]);
		});
	});
});
