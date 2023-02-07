import { processInstallation } from "../sync/installation";
import { mocked } from "jest-mock";
import { backfillQueueMessageHandler } from "./backfill";
import { BackfillMessagePayload, SQSMessageContext } from "~/src/sqs/sqs.types";
import { getLogger } from "config/logger";
import * as Sentry from "@sentry/node";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { sqsQueues } from "~/src/sqs/queues";

jest.mock("config/feature-flags");
jest.mock("../sync/installation");
jest.mock("@sentry/node");
jest.mock("~/src/sqs/queues");

const sentryCaptureExceptionMock = jest.fn();

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
mocked(Sentry.Hub).mockImplementation(() => ({
	configureScope: jest.fn(),
	setTag: jest.fn(),
	setExtra: jest.fn(),
	captureException: sentryCaptureExceptionMock
} as Sentry.Hub));

const mockSentryGetClient = () => {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	mocked(Sentry.getCurrentHub).mockImplementation(() => ({
		getClient: jest.fn()
	}));
};

const mockPreemptiveRateLimit = (threshold: number): void => {
	when(numberFlag).calledWith(
		NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
		expect.anything(),
		expect.anything()
	).mockResolvedValue(threshold);
};

const mockGitHubRateLimitResponse = (coreLimit = 100, coreRemaining = 100): void => {
	githubUserTokenNock(123);
	githubNock.get("/rate_limit")
		.reply(200, {
			"resources": {
				"core": {
					"limit": coreLimit,
					"remaining": coreRemaining,
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

describe("backfill", () => {
	const BACKFILL_MESSAGE_CONTEXT: SQSMessageContext<BackfillMessagePayload> = {
		payload: {
			installationId: 123,
			jiraHost: "https://test.atlassian.net"
		},
		message: {},
		log: getLogger("test"),
		receiveCount: 1,
		lastAttempt: false
	};

	describe("Sentry", () => {
		beforeEach(() => {
			mockSentryGetClient();
			mockPreemptiveRateLimit(100);
			mockGitHubRateLimitResponse();
		});

		it("sentry captures exception", async () => {
			const mockedProcessor = jest.fn();
			mocked(processInstallation).mockReturnValue(mockedProcessor);
			mockedProcessor.mockRejectedValue(new Error("something went horribly wrong"));
			await backfillQueueMessageHandler(BACKFILL_MESSAGE_CONTEXT).catch(e => getLogger("test").warn(e));
			expect(sentryCaptureExceptionMock).toBeCalled();
		});

		afterEach(() => {
			sentryCaptureExceptionMock.mockReset();
		});
	});

	describe("Preemptive rate limit", () => {

		beforeEach(() => {
			mockSentryGetClient();
		});

		it("Should stop processing if preemptive threshold is met", async () => {
			mockPreemptiveRateLimit(50);
			mockGitHubRateLimitResponse(100, 10);

			await backfillQueueMessageHandler(BACKFILL_MESSAGE_CONTEXT);
			expect(sqsQueues.backfill.changeVisibilityTimeout).toBeCalled();
		});

		it("Should continue processing if rate limit still has a sufficient amount remaining", async () => {
			mockPreemptiveRateLimit(50);
			mockGitHubRateLimitResponse(100, 51);

			const mockedProcessor = jest.fn();
			mocked(processInstallation).mockReturnValue(mockedProcessor);
			await backfillQueueMessageHandler(BACKFILL_MESSAGE_CONTEXT);
			expect(sqsQueues.backfill.changeVisibilityTimeout).not.toBeCalled();
		});

	});

});
