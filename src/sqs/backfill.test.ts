import { processInstallation } from "../sync/installation";
import { mocked } from "ts-jest/utils";
import { BackfillMessagePayload, backfillQueueMessageHandler } from "./backfill";
import { Context } from "./index";
import { getLogger } from "config/logger";
import * as Sentry from "@sentry/node";

jest.mock("../sync/installation");
jest.mock("@sentry/node");

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
	const BACKFILL_MESSAGE_CONTEXT: Context<BackfillMessagePayload> = {
		payload: {
			installationId: 123,
			jiraHost: "https://test.atlassian.net"
		},
		message: {},
		log: getLogger("test"),
		receiveCount: 1,
		lastAttempt: false
	};

	afterEach(() => {
		sentryCaptureExceptionMock.mockReset();
	});

	it("sentry captures exception", async () => {
		const mockedProcessor = jest.fn();
		mocked(processInstallation).mockReturnValue(mockedProcessor);
		mockedProcessor.mockRejectedValue(new Error("something went horribly wrong"));
		await backfillQueueMessageHandler(BACKFILL_MESSAGE_CONTEXT).catch(e => console.warn(e));
		expect(sentryCaptureExceptionMock).toBeCalled();
	});
});
