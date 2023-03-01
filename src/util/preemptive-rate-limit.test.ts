import { preemptiveRateLimitCheck } from "utils/preemptive-rate-limit";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

const TEST_INSTALLATION_ID = 1234;

const mockGitHubRateLimitFail = () => {
	githubUserTokenNock(TEST_INSTALLATION_ID);
	githubNock.get(`/rate_limit`)
		.reply(404);
};

const mockGitHubRateLimit = (limit , remaining) => {
	githubUserTokenNock(TEST_INSTALLATION_ID);
	githubNock.get(`/rate_limit`)
		.reply(200, {
			"resources": {
				"core": {
					"limit": limit,
					"remaining": remaining,
					"reset": 1372700873
				},
				"graphql": {
					"limit": 5000,
					"remaining": 5000,
					"reset": 1372700389
				}
			}
		});
};

describe("Preemptive rate limit check - Cloud", () => {

	it(`Should return true since the remaining percent is greater than the threshold`, async () => {

		when(numberFlag).calledWith(
			NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(50);

		mockGitHubRateLimit(100, 30);
		const message = {
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
		};
		const sqsQueue = {
			queueName: "backfill",
			changeVisibilityTimeout: jest.fn()
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await preemptiveRateLimitCheck(message, sqsQueue)).toBe(true);
	});

	it(`Should return false since threshold is not met`, async () => {

		when(numberFlag).calledWith(
			NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(90);

		mockGitHubRateLimit(100, 99);
		const sqsQueue = {
			queueName: "backfill",
			changeVisibilityTimeout: jest.fn()
		};
		const message = {
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
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await preemptiveRateLimitCheck(message, sqsQueue)).toBe(false);
	});

	it(`Should not attempt to preempt when invalid quene name`, async () => {
		const sqsQueue = {
			queueName: "cats",
			changeVisibilityTimeout: jest.fn()
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await preemptiveRateLimitCheck({}, sqsQueue)).toBe(false);
	});

	it(`Shold return true if something goes wrong during rate limit checking`, async () => {
		when(numberFlag).calledWith(
			NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(50);

		mockGitHubRateLimitFail();
		const sqsQueue = {
			queueName: "backfill",
			changeVisibilityTimeout: jest.fn()
		};
		const message = {
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
				warn: jest.fn(),
				error: jest.fn()
			}
		};
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await preemptiveRateLimitCheck(message, sqsQueue)).toBe(true);
	});

});
