import { preemptiveRateLimitCheck } from "utils/preemptive-rate-limit";

describe.skip("Test things", () => {
	it(`Testing things`, () => {
		const callback = jest.fn();
		const MOCK_QUEUE_NAME = "backfill";
		const message = {
			payload: {},
			message: {},
			log: {
				info: jest.fn(),
				warn: jest.fn()
			},
			receiveCount: 0,
			lastAttempt: "false"
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(preemptiveRateLimitCheck(message, MOCK_QUEUE_NAME, callback)).toBe(true);
	});


	it(`Should not attempt to preempt when invalid quene name`, () => {
		const callback = jest.fn();
		const MOCK_QUEUE_NAME = "cats";
		const message = {
			payload: {},
			message: {},
			log: jest.fn(),
			receiveCount: 0,
			lastAttempt: "false"
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(preemptiveRateLimitCheck(message, MOCK_QUEUE_NAME, callback)).toBe(false);
	});
});
