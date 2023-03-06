import { preemptiveRateLimitCheck, DEFAULT_PREEMPTY_RATELIMIT_DELAY_IN_SECONDS  } from "utils/preemptive-rate-limit";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";
import type { SQSMessageContext, BaseMessagePayload } from "~/src/sqs/sqs.types";

jest.mock("config/feature-flags");

const TEST_INSTALLATION_ID = 1234;
const ONE_MINUTES_IN_SECONDS = 1 * 60;
const THIRTY_MINUTES_IN_SECONDS = 30 * 60;

const mockGitHubRateLimit = (limit , remaining, resetTime) => {
	githubUserTokenNock(TEST_INSTALLATION_ID);
	githubNock.get(`/rate_limit`)
		.reply(200, {
			"resources": {
				"core": {
					"limit": limit,
					"remaining": remaining,
					"reset": resetTime
				},
				"graphql": {
					"limit": 5000,
					"remaining": 5000,
					"reset": resetTime
				}
			}
		});
};

const mockRatelimitThreshold = (threshold: number) => {
	when(numberFlag).calledWith(
		NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
		expect.anything(),
		expect.anything()
	).mockResolvedValue(threshold);
};

const getMessage = (): SQSMessageContext<BaseMessagePayload> => {
	return {
		payload: {
			jiraHost: "JIRAHOST_MOCK",
			installationId: TEST_INSTALLATION_ID,
			gitHubAppConfig: {
				gitHubAppId: 1
			}
		},
		message: {},
		log: {
			info: jest.fn(),
			warn: jest.fn()
		}
	} as any;
};

describe("Preemptive rate limit check - Cloud", () => {

	let sqsQueue;
	let message;
	let fakeDate;
	let nowInSeconds;

	beforeEach(() => {
		sqsQueue = {
			queueName: "backfill",
			changeVisibilityTimeout: jest.fn()
		};
		message = getMessage();
		fakeDate = 1678021200000; //2023-03-06T00:00:00
		jest.spyOn(global.Date, "now").mockImplementation(() => { return fakeDate; });
		nowInSeconds = fakeDate / 1000;
	});

	it(`Should return true since the remaining percent is greater than the threshold`, async () => {
		mockRatelimitThreshold(50);
		mockGitHubRateLimit(100, 30, nowInSeconds + THIRTY_MINUTES_IN_SECONDS);
		expect(await preemptiveRateLimitCheck(message, sqsQueue)).toEqual({
			isExceedThreshold: true,
			resetTimeInSeconds: THIRTY_MINUTES_IN_SECONDS
		});
	});

	it(`Should use default time delay if rest time is negative`, async () => {
		mockRatelimitThreshold(50);
		mockGitHubRateLimit(100, 30, nowInSeconds + ONE_MINUTES_IN_SECONDS);
		expect(await preemptiveRateLimitCheck(message, sqsQueue)).toEqual({
			isExceedThreshold: true,
			resetTimeInSeconds: DEFAULT_PREEMPTY_RATELIMIT_DELAY_IN_SECONDS
		});
	});

	it(`Should return false since threshold is not met`, async () => {
		mockRatelimitThreshold(90);
		mockGitHubRateLimit(100, 99, nowInSeconds + THIRTY_MINUTES_IN_SECONDS);
		expect(await preemptiveRateLimitCheck(message, sqsQueue)).toEqual({
			isExceedThreshold: false
		});
	});

	it(`Should not attempt to preempt when invalid quene name`, async () => {
		sqsQueue.queueName = "cats";
		expect(await preemptiveRateLimitCheck(message, sqsQueue)).toEqual({
			isExceedThreshold: false
		});
	});

});
