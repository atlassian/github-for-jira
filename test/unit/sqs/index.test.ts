import { Context, SqsQueue } from "../../../src/sqs";
import { v4 as uuidv4 } from "uuid";
import envVars from "../../../src/config/env";
import DoneCallback = jest.DoneCallback;


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

	const mockRequestHandler = {
		handle: jest.fn()
	};

	const generatePayload = (): TestMessage => ({ msg: uuidv4() });

	const createSqsQueue = () => {
		return new SqsQueue({
			queueName: TEST_QUEUE_NAME,
			queueUrl: TEST_QUEUE_URL,
			queueRegion: TEST_QUEUE_REGION,
			longPollingIntervalSec: 0
		},
		mockRequestHandler);
	};

	let queue: SqsQueue<TestMessage>;

	beforeEach(() => {
		queue = createSqsQueue();
		queue.start();
	});

	afterEach(() => {
		queue.stop();
		delay(100);
	});

	test("Message gets received", (done: DoneCallback) => {

		const testPayload = generatePayload();

		mockRequestHandler.handle.mockImplementation((context: Context<TestMessage>) => {
			expect(context.payload).toStrictEqual(testPayload);
			done();
		});
		queue.sendMessage(testPayload);
	});


	test("Queue is restartable", (done: DoneCallback) => {

		const testPayload = generatePayload();

		mockRequestHandler.handle.mockImplementation((context: Context<TestMessage>) => {
			expect(context.payload).toStrictEqual(testPayload);
			done();
		});

		queue.stop();

		//delaying to make sure all asynchronous invocations inside the queue will be finished and it will stop
		delay(10);

		queue.start();

		queue.sendMessage(testPayload);
	});

	test("Message received with delay", (done: DoneCallback) => {

		const testPayload = { msg: "Hi4" };
		const receivedTime = { time: new Date().getTime() };

		mockRequestHandler.handle.mockImplementation((context: Context<TestMessage>) => {
			try {
				context.log.info("hi");
				const currentTime = new Date().getTime();
				expect(currentTime - receivedTime.time).toBeGreaterThanOrEqual(1000);
				done();
			} catch (err) {
				done(err);
			}
		});
		queue.sendMessage(testPayload, 1);
	});

	test("Message gets executed exactly once", (done: DoneCallback) => {

		const testPayload = generatePayload();
		const testData: { messageId: undefined | string } = { messageId: undefined };

		mockRequestHandler.handle.mockImplementation((context: Context<TestMessage>) => {

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
				done(err);
			}
		});
		queue.sendMessage(testPayload);

		//code before the pause
		setTimeout(function() {
			if (testData.messageId) {
				done();
			} else {
				done.fail("No message was received");
			}
		}, 3000);

	});


	//TODO Add tests for parallel processing when it will be implemented, set concurrency level to 1 for this test
	test("Messages are not processed in parallel", async (done: DoneCallback) => {

		const testPayload = generatePayload();
		const receivedTime = { time: new Date().getTime(), counter: 0 };

		mockRequestHandler.handle.mockImplementation(async (context: Context<TestMessage>) => {
			try {

				if (receivedTime.counter == 0) {
					receivedTime.counter++;
					context.log.info("Delaying the message");
					await delay(1000);
					context.log.info("Message processed after delay");
					return;
				}

				const currentTime = new Date().getTime();
				expect(currentTime - receivedTime.time).toBeGreaterThanOrEqual(1000);
				done();
			} catch (err) {
				done(err);
			}
		});
		await queue.sendMessage(testPayload);
		await delay(100);
		queue.sendMessage(testPayload);
	});
});
