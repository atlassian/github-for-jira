import {SqsQueue, Context} from "../../../src/sqs";
import DoneCallback = jest.DoneCallback;



const TEST_QUEUE_URL = "http://localhost:9602/queue/test"
const TEST_QUEUE_REGION = "us-west-1"
const TEST_QUEUE_NAME = "test"

type TestMessage = {msg: string}

//We have to disable this rule here hence there is no way to have a proper test for sqs queue with await here
/* eslint-disable jest/no-done-callback */
describe("SqsQueue tests", () => {

	const mockRequestHandler = {
		handle: jest.fn()
	}

	const createSqsQueue = () => {
		return new SqsQueue(TEST_QUEUE_NAME, TEST_QUEUE_URL, TEST_QUEUE_REGION, mockRequestHandler);
	}

	let queue : SqsQueue<TestMessage>;

	beforeEach(() => {
		queue = createSqsQueue()
		queue.listen();
	})

	afterEach(() => {
		queue.stop();
	})

	test("Message gets received", (done:DoneCallback) => {

		const testPayload = { msg: "Hi"};

		mockRequestHandler.handle.mockImplementation((context: Context<TestMessage>) => {
			expect(context.payload).toStrictEqual(testPayload);
			done();
		})
		queue.sendMessage(testPayload);
	});


	test("Context Logger has messageId and executionId", (done:DoneCallback) => {

		const testPayload = { msg: "Hi"};

		mockRequestHandler.handle.mockImplementation((context: Context<TestMessage>) => {
			context.log.info("hi");
			expect(context.log).toStrictEqual(testPayload);
			done();
		})
		queue.sendMessage(testPayload);
	});


});
