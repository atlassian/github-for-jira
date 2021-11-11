import {Context, ErrorHandlingResult, SqsQueue, SqsTimeoutError} from "../../../src/sqs";
import { v4 as uuidv4 } from "uuid";
import envVars from "../../../src/config/env";
import DoneCallback = jest.DoneCallback;
import waitUntil from "../../utils/waitUntil";


const TEST_QUEUE_URL = envVars.SQS_BACKFILL_QUEUE_URL;
const TEST_QUEUE_REGION = envVars.SQS_BACKFILL_QUEUE_REGION;
const TEST_QUEUE_NAME = "test";

type TestMessage = { msg: string }

function delay(time) {
	return new Promise(resolve => setTimeout(resolve, time));
}

//We have to disable this rule here hence there is no way to have a proper test for sqs queue with await here
/* eslint-disable jest/no-done-callback */
describe("SqsQueue tests", () => {

	const mockRequestHandler = jest.fn();

	const mockErrorHandler = jest.fn();

	const generatePayload = (): TestMessage => {
		const payload = {msg: uuidv4()};
		console.log("Generated test payload: " + JSON.stringify(payload));
		return payload
	};


	const createSqsQueue = (timeout: number) => {
		return new SqsQueue({
			queueName: TEST_QUEUE_NAME,
			queueUrl: TEST_QUEUE_URL,
			queueRegion: TEST_QUEUE_REGION,
			longPollingIntervalSec: 0,
			timeoutSec: timeout,
			maxAttempts: 3
		},
		mockRequestHandler,
		mockErrorHandler);
	};

	let queue: SqsQueue<TestMessage>;

	describe("Normal execution tests", () => {

		beforeEach(() => {
			queue = createSqsQueue(10);
			queue.start();
		});

		afterEach(async () => {
			queue.stop();
			await queue.waitUntilListenerStopped();
		});

		it("Message gets received", (done: DoneCallback) => {

			const testPayload = generatePayload();

			mockRequestHandler.mockImplementation((context: Context<TestMessage>) => {
				expect(context.payload).toStrictEqual(testPayload);
				done();
			});
			queue.sendMessage(testPayload);
		});


		it("Queue is restartable", async (done: DoneCallback) => {

			const testPayload = generatePayload();

			mockRequestHandler.mockImplementation((context: Context<TestMessage>) => {
				expect(context.payload).toStrictEqual(testPayload);
				done();
			});

			queue.stop();

			//delaying to make sure all asynchronous invocations inside the queue will be finished and it will stop
			await queue.waitUntilListenerStopped();

			queue.start();

			queue.sendMessage(testPayload);
		});

		it("Message received with delay", (done: DoneCallback) => {

			const testPayload = generatePayload();
			const receivedTime = {time: Date.now()};

			mockRequestHandler.mockImplementation((context: Context<TestMessage>) => {
				context.log.info("hi");
				const currentTime = Date.now();
				expect(currentTime - receivedTime.time).toBeGreaterThanOrEqual(1000);
				done();
			});
			queue.sendMessage(testPayload, 1);
		});

		it("Message gets executed exactly once", (done: DoneCallback) => {

			const testPayload = generatePayload();
			const testData: { messageId: undefined | string } = {messageId: undefined};

			mockRequestHandler.mockImplementation((context: Context<TestMessage>) => {

				try {
					expect(context.payload).toStrictEqual(testPayload);

					if (!testData.messageId) {
						testData.messageId = context.message.MessageId;
					} else if (testData.messageId === context.message.MessageId) {
						done.fail("Message was received more than once");
					} else {
						done.fail("Different message on the tests queue");
					}

				} catch (err) {
					done.fail(err);
				}
			});
			queue.sendMessage(testPayload);

			//code before the pause
			setTimeout(function () {
				if (testData.messageId) {
					done();
				} else {
					done.fail("No message was received");
				}
			}, 3000);

		});

		it("Messages are not processed in parallel", async (done: DoneCallback) => {

			const testPayload = generatePayload();
			const receivedTime = {time: Date.now(), counter: 0};

			mockRequestHandler.mockImplementation(async (context: Context<TestMessage>) => {
				try {

					if (receivedTime.counter == 0) {
						receivedTime.counter++;
						context.log.info("Delaying the message");
						await delay(1000);
						context.log.info("Message processed after delay");
						return;
					}

					const currentTime = Date.now();
					expect(currentTime - receivedTime.time).toBeGreaterThanOrEqual(1000);
					done();
				} catch (err) {
					done(err);
				}
			});
			await queue.sendMessage(testPayload);
			await queue.sendMessage(testPayload);
		});

		it("Retries with the correct delay", async (done: DoneCallback) => {

			const testErrorMessage = "Something bad happened";
			const testPayload = generatePayload();
			const receivedTime = {time: Date.now(), receivesCounter: 0, errorHandlingCounter: 0};

			mockRequestHandler.mockImplementation(async (context: Context<TestMessage>) => {

				if (receivedTime.receivesCounter == 0) {
					receivedTime.receivesCounter++;
					context.log.info("Throwing error on first processing");
					throw new Error("Something bad happened");
				}

				expect(receivedTime.receivesCounter).toBe(1);
				expect(receivedTime.errorHandlingCounter).toBe(1);

				const currentTime = Date.now();
				expect(currentTime - receivedTime.time).toBeGreaterThanOrEqual(1000);
				done();
				return;
			});

			mockErrorHandler.mockImplementation((error: Error, context: Context<TestMessage>) : ErrorHandlingResult => {
				expect(context.payload.msg).toBe(testPayload.msg)
				expect(error.message).toBe(testErrorMessage)
				receivedTime.errorHandlingCounter++;
				return {retryable: true, retryDelaySec: 1}
			})

			await queue.sendMessage(testPayload);
		});

		it("Message deleted from the queue when unretryable", async () => {

			const testPayload = generatePayload();

			const queueDeletionSpy = jest.spyOn(queue.sqs, 'deleteMessage');

			const expected : {ReceiptHandle?: string} = {ReceiptHandle: ""};

			mockRequestHandler.mockImplementation(async (context: Context<TestMessage>) => {
				expected.ReceiptHandle = context.message.ReceiptHandle;

				throw new Error("Something bad happened");
			});

			mockErrorHandler.mockImplementation(() : ErrorHandlingResult => {
				return {retryable: false};
			})

			await queue.sendMessage(testPayload);

			await waitUntil(async () => {
				expect(queueDeletionSpy).toBeCalledTimes(1)
			})
		});

	});

	describe("Timeouts tests", () => {

		beforeEach(() => {
			queue = createSqsQueue(1);
			queue.start();
		});

		afterEach(async () => {
			queue.stop();
			await queue.waitUntilListenerStopped();
		});

		it("Timeout works", async (done: DoneCallback) => {

			const testPayload = generatePayload();
			const receivedTime = {time: Date.now(), counter: 0};

			mockRequestHandler.mockImplementation(async (context: Context<TestMessage>) => {
				context.log.info("Delaying the message for 2 secs");
				await delay(2000);
				return;
			});

			mockErrorHandler.mockImplementation((error: Error, context: Context<TestMessage>) => {

				expect(context.payload.msg).toBe(testPayload.msg);
				expect(error).toBeInstanceOf(SqsTimeoutError);

				const currentTime = Date.now();
				expect(currentTime - receivedTime.time).toBeGreaterThanOrEqual(1000);
				done();
				return {retryable: false};
			})

			await queue.sendMessage(testPayload);
		});
	});
});
