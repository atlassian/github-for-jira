import { isRetryableWithSmallerRequest, processInstallation } from "../../../src/sync/installation";

import {DeduplicatorResult} from "../../../src/sync/deduplicator";

import {Application} from "probot";
import {getLogger} from "../../../src/config/logger";

import '../../../src/config/feature-flags';
import {BooleanFlags} from "../../../src/config/feature-flags";

const mockedExecuteWithDeduplication = jest.fn();
jest.mock('../../../src/sync/deduplicator', () => {
	return {
		...jest.requireActual('../../../src/sync/deduplicator'),
		Deduplicator: function() {
			return { executeWithDeduplication: mockedExecuteWithDeduplication };
		}
	}
});

jest.mock('../../../src/config/feature-flags', () => {
	return {
		...jest.requireActual('../../../src/config/feature-flags'),
		booleanFlag: (key) => Promise.resolve(key === BooleanFlags.USE_DEDUPLICATOR_FOR_BACKFILLING)
	};
});

describe("sync/installation", () => {

	beforeEach(() => {
		mockedExecuteWithDeduplication.mockReset();
	})

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
			await processInstallation(app, queues)(job, logger);
			expect(mockedExecuteWithDeduplication.mock.calls.length).toBe(1);
		});

		test('should reschedule the job if deduplicator is unsure', async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER);
			await processInstallation(app, queues)(job, logger);
			expect(queues.installation.add.mock.calls).toEqual([[job.data, {delay: 60_000}]]);
		});

		test('should drop the job if deduplicator is sure', async () => {
			mockedExecuteWithDeduplication.mockResolvedValue(DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB);
			await processInstallation(app, queues)(job, logger);
			expect(queues.installation.add.mock.calls.length).toEqual(0);
		});
	});
});
