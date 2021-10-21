import { Context, SqsQueue } from "../../../src/sqs";
import { v4 as uuidv4 } from "uuid";
import envVars from "../../../src/config/env";
import DoneCallback = jest.DoneCallback;

type TestMessage = { msg: string }

function delay(time) {
	return new Promise(resolve => setTimeout(resolve, time));
}

//We have to disable this rule here hence there is no way to have a proper test for sqs queue with await here
/* eslint-disable jest/no-done-callback */
describe("SqsQueue tests", () => {

	let listening: Promise<unknown>;
	const mockRequestHandler = {
		handle: jest.fn()
	};

	const generatePayload = (): TestMessage => ({ msg: uuidv4() });

	let queue: SqsQueue<TestMessage>;

	beforeEach(() => {
		queue = new SqsQueue({
			queueUrl: envVars.PROCESS_QUEUE_URL,
			longPollingIntervalSec: 0
		}, mockRequestHandler);
		listening = queue.start();
	});

	afterEach(async () => {
		queue.stop();
		await listening;
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
		queue.sendMessage(testPayload);
		queue.start();
	});

	test("Message received with delay", (done: DoneCallback) => {
		const testPayload = { msg: "Hi4" };
		const startTime = Date.now();
		mockRequestHandler.handle.mockImplementation((context: Context<TestMessage>) => {
			context.log.info("hi");
			expect(Date.now() - startTime).toBeGreaterThanOrEqual(1000);
			done();
		});
		queue.sendMessage(testPayload, 1);
	});

	test("Message gets executed exactly once", (done: DoneCallback) => {
		const testPayload = generatePayload();

		mockRequestHandler.handle.mockImplementation(async (context: Context<TestMessage>) => {
			expect(context.payload).toStrictEqual(testPayload);
			const result = await queue.receiveMessage();
			expect(result.Messages).toBeFalsy();
			done();
		});
		queue.sendMessage(testPayload);
	});


	//TODO Add tests for parallel processing when it will be implemented, set concurrency level to 1 for this test
	test("Messages are not processed in parallel", (done: DoneCallback) => {

		const testPayload = generatePayload();
		const startTime = Date.now();
		let counter = 0;
		const delayTime = 200;

		mockRequestHandler.handle.mockImplementation(async () => {
			if (counter == 0) {
				counter++;
				await delay(delayTime);
				return;
			}
			expect(Date.now() - startTime).toBeGreaterThanOrEqual(delayTime);
			done();
		});
		queue.sendMessage(testPayload);
		queue.sendMessage(testPayload);
	});
});
