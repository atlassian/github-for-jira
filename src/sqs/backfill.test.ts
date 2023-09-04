import { processInstallation } from "../sync/installation";
import { mocked } from "jest-mock";
import { backfillQueueMessageHandler } from "./backfill";
import { BackfillMessagePayload, SQSMessageContext } from "~/src/sqs/sqs.types";
import { getLogger } from "config/logger";
import * as Sentry from "@sentry/node";

jest.mock("config/feature-flags");
jest.mock("../sync/installation");
jest.mock("@sentry/node");
jest.mock("~/src/sqs/queues");

const sentryCaptureExceptionMock = jest.fn();

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
mocked(Sentry.Hub).mockImplementation(() => ({
	configureScope: jest.fn(),
	setTag: jest.fn(),
	setExtra: jest.fn(),
	captureException: sentryCaptureExceptionMock
} as Sentry.Hub));

const mockSentryGetClient = () => {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-expect-error
	mocked(Sentry.getCurrentHub).mockImplementation(() => ({
		getClient: jest.fn()
	}));
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
		});

		it("sentry captures exception", async () => {
			const mockedProcessor = jest.fn();
			mocked(processInstallation).mockReturnValue(mockedProcessor);
			mockedProcessor.mockRejectedValue(new Error("something went horribly wrong"));
			await backfillQueueMessageHandler(jest.fn())(BACKFILL_MESSAGE_CONTEXT).catch(e => getLogger("test").warn(e));
			expect(sentryCaptureExceptionMock).toBeCalled();
		});

		afterEach(() => {
			sentryCaptureExceptionMock.mockReset();
		});
	});

});
