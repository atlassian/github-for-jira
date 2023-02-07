import { processInstallation } from "../sync/installation";
import { mocked } from "ts-jest/utils";
import { backfillQueueMessageHandler } from "./backfill";
import { BackfillMessagePayload, SQSMessageContext } from "~/src/sqs/sqs.types";
import { getLogger } from "config/logger";
import * as Sentry from "@sentry/node";
import { when } from "jest-when";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { sqsQueues } from "~/src/sqs/queues";
// import { sqsQueues } from "~/src/sqs/queues";

jest.mock("config/feature-flags");
jest.mock("../sync/installation");
jest.mock("@sentry/node");
jest.mock("~/src/sqs/queues");


// const sqsQueuesMock = {
// 	backfill: {
// 		changeVisibilityTimeout: jest.fn().mockReturnValue("DO A THING")
// 	}
// };
// jest.mock("~/src/sqs/queues", () => {
// 	return jest.fn().mockImplementation(() => {
// 		return {
// 			backfill: sqsQueuesMock
// 		};
// 	});
// });

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
mocked(Sentry.getCurrentHub).mockImplementation(() => ({
	getClient: jest.fn()
}));

const sentryCaptureExceptionMock = jest.fn();

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
mocked(Sentry.Hub).mockImplementation(() => ({
	configureScope: jest.fn(),
	setTag: jest.fn(),
	setExtra: jest.fn(),
	captureException: sentryCaptureExceptionMock
} as Sentry.Hub));

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

	// beforeEach(() => {
	//
	//
	//
	// });


	afterEach(() => {
		sentryCaptureExceptionMock.mockReset();
	});

	it.skip("sentry captures exception", async () => {
		when(numberFlag).calledWith(
			NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(100);
		githubUserTokenNock(123);
		githubNock.get("/rate_limit")
			.reply(200, {
				"resources": {
					"core": {
						"limit": 5000,
						"remaining": 5000,
						"reset": 1372700873
					},
					"graphql": {
						"limit": 5000,
						"remaining": 5000,
						"reset": 1372700389
					}
				}
			});


		const mockedProcessor = jest.fn();
		mocked(processInstallation).mockReturnValue(mockedProcessor);
		mockedProcessor.mockRejectedValue(new Error("something went horribly wrong"));
		await backfillQueueMessageHandler(BACKFILL_MESSAGE_CONTEXT).catch(e => getLogger("test").warn(e));
		expect(sentryCaptureExceptionMock).toBeCalled();
	});

	it("Should stop processing if preemptive threshold is met", async () => {

		when(numberFlag).calledWith(
			NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(50);

		githubUserTokenNock(123);
		githubNock.get("/rate_limit")
			.reply(200, {
				"resources": {
					"core": {
						"limit": 5000,
						"remaining": 1000,
						"reset": 1372700873
					},
					"graphql": {
						"limit": 5000,
						"remaining": 1000,
						"reset": 1372700389
					}
				}
			});
		const mockedProcessor = jest.fn();
		mocked(processInstallation).mockReturnValue(mockedProcessor);
		mockedProcessor.mockRejectedValue(new Error("something went horribly wrong"));
		await backfillQueueMessageHandler(BACKFILL_MESSAGE_CONTEXT).catch(e => getLogger("test").warn(e));
		expect(sqsQueues.backfill.changeVisibilityTimeout).toBeCalled();
	});


});
