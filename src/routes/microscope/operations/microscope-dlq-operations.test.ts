import {
	deleteMessage,
	deleteMessages,
	microscopeDlqHealthcheck,
	queryQueueAttributes,
	queryQueueMessages,
	queryQueues,
	requeueMessage,
	requeueMessages
} from "./microscope-dlq-operations";

const queueName = "push";
const getQueuesResponse = {
	shortName: queueName
};

const queryQueuesAttributesResponse = {
	queueShortName: queueName,
	attributes: {
		ApproximateNumberOfMessages: "3"
	}
};

const queryQueueMessagesResponse = {
	messageId: "id",
	receiptHandle: "handler",
	body: "this is a test message",
	attributes: {
		attr1: "something"
	},
	messageAttributes: {}
};

const getQueuesMock = jest.fn().mockReturnValue(getQueuesResponse);
const getQueuesAttributesMock = jest.fn().mockReturnValue(queryQueuesAttributesResponse);
const getMessagesMock = jest.fn().mockReturnValue(queryQueueMessagesResponse);
const requeueMessageMock = jest.fn();
const requeueMessagesMock = jest.fn();
const deleteMessageMock = jest.fn();
const deleteMessagesMock = jest.fn();

jest.mock("@atlassian/sqs-queue-dlq-service", () => {
	return {
		DlqService: jest.fn(() => ({
			getQueues: () => getQueuesMock(),
			getQueuesAttributes: () => getQueuesAttributesMock(),
			getMessages: () => getMessagesMock(),
			requeueMessage: () => requeueMessageMock(),
			requeueMessages: () => requeueMessagesMock(),
			deleteMessage: () => deleteMessageMock(),
			deleteMessages: () => deleteMessagesMock()
		}))
	};
});

describe("microscope dlq", () => {
	let req, res;

	beforeEach(async () => {
		req = {
			query: {},
			params: {}
		};

		res = {
			send: jest.fn(),
			status: jest.fn()
		};
	});

	afterEach(async () => {
		jest.clearAllMocks();
	});

	it("healthcheck should respond with 200", async () => {
		await microscopeDlqHealthcheck(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.send).toHaveBeenCalledWith("OK");
	});

	it("query queues should return list of service queues", async () => {
		await queryQueues(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.send).toHaveBeenCalledWith(getQueuesResponse);
	});

	it("query queue attributes should return list of attributes", async () => {
		await queryQueueAttributes(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.send).toHaveBeenCalledWith(queryQueuesAttributesResponse);
	});

	it("query queue messages should return list of visible messages", async () => {
		req.params = { queueName };
		req.query.limit = 5;
		await queryQueueMessages(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.send).toHaveBeenCalledWith(queryQueueMessagesResponse);
	});

	it("requeue message should return 200", async () => {
		await requeueMessage(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
	});

	it("requeue messages should return 200", async () => {
		await requeueMessages(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
	});

	it("delete message should return 200", async () => {
		await deleteMessage(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
	});

	it("delete messages should return 200", async () => {
		await deleteMessages(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
	});
});
