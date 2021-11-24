import {
	BackfillQueue,
	isRetryableWithSmallerRequest,
	maybeScheduleNextTask,
	processInstallation
} from "../../../src/sync/installation";

import {DeduplicatorResult} from "../../../src/sync/deduplicator";

import '../../../src/config/feature-flags';
import {BooleanFlags} from "../../../src/config/feature-flags";

import {Application} from "probot";
import {getLogger} from "../../../src/config/logger";

import Queue from "bull";

let mockedBooleanFeatureFlags = {};
jest.mock('../../../src/config/feature-flags', () => {
	return {
		...jest.requireActual('../../../src/config/feature-flags'),
		booleanFlag: (key) => Promise.resolve(mockedBooleanFeatureFlags[key])
	};
});


const mockedExecuteWithDeduplication = jest.fn();
jest.mock('../../../src/sync/deduplicator', () => {
	return {
		...jest.requireActual('../../../src/sync/deduplicator'),
		Deduplicator: function() {
			return { executeWithDeduplication: mockedExecuteWithDeduplication };
		}
	}
});

jest.mock("../../../src/models");

describe("sync/installation", () => {

	const backfillQueue: BackfillQueue = {
		schedule: jest.fn()
	}

	const backfillQueueSchedule: jest.Mock = backfillQueue.schedule as jest.Mock;

	beforeEach(() => {
		mockedExecuteWithDeduplication.mockReset();
		mockedBooleanFeatureFlags[BooleanFlags.USE_BACKFILL_QUEUE_SUPPLIER] = true;
	});

	afterEach(() => {
		mockedBooleanFeatureFlags = {};
		(backfillQueue.schedule as jest.Mock).mockReset();
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

	describe('processInstallation', () => {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const app: Application = jest.fn() as Application;
		const queues = {
			installation: {
				add: jest.fn()
			}
		};
		const job = {
			data: {
				installationId: 1,
				jiraHost: 'https://blah.atlassian.com'
			},
			sentry: {
				setUser: jest.fn()
			}
		};
		const logger = getLogger('test');

		test('should process the installation with deduplication', async () => {
			await processInstallation(app, queues, () => Promise.resolve(backfillQueue))(job, logger);
			expect(mockedExecuteWithDeduplication.mock.calls.length).toBe(1);
		});

		test('should reschedule the job if deduplicator is unsure', async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER);
			await processInstallation(app, queues, () => Promise.resolve(backfillQueue))(job, logger);
			expect(backfillQueueSchedule.mock.calls).toEqual([[job.data, 60_000]]);
		});

		test('should also reschedule the job if deduplicator is sure', async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB);
			await processInstallation(app, queues, () => Promise.resolve(backfillQueue))(job, logger);
			expect(backfillQueueSchedule.mock.calls.length).toEqual(1);
		});
	});

	describe('maybeScheduleNextTask', () => {
		test('does nothing if there is no next task', () => {
			const queue = {
				add: jest.fn()
			};
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			maybeScheduleNextTask(queue as Queue.Queue, backfillQueue, {foo: 'bar'}, [], getLogger('test'));
			expect(backfillQueueSchedule.mock.calls).toHaveLength(0);
		});

		test('when multiple tasks, picks the one with the highest delay', async () => {
			const queue = {
				add: jest.fn()
			};
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore

			await maybeScheduleNextTask(queue as Queue.Queue, backfillQueue, {foo: 'bar'}, [30, 60, 0], getLogger('test'));
			expect(backfillQueueSchedule.mock.calls).toEqual([[{foo: 'bar'}, 60]]);
		});

		test('not passing delay to queue when not provided', async () => {
			const queue = {
				add: jest.fn()
			};
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			await maybeScheduleNextTask(queue as Queue.Queue, backfillQueue, {foo: 'bar'}, [0], getLogger('test'));
			expect(backfillQueueSchedule.mock.calls).toEqual([[{foo: 'bar'}, 0]]);
		});
	});
});
