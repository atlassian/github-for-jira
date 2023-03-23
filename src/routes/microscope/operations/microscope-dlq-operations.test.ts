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
import { optionalRequire } from "optional-require";

const { DlqService } = optionalRequire("@atlassian/sqs-queue-dlq-service", true) || {};

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

if (DlqService) {
	jest.mock("@atlassian/sqs-queue-dlq-service");
}

describe("microscope dlq", () => {
	let req, res;

	if (DlqService) {
		beforeEach(async () => {
			jest.spyOn(DlqService.prototype, "getQueues").mockResolvedValue([getQueuesResponse]);
			jest.spyOn(DlqService.prototype, "getQueuesAttributes").mockResolvedValue([queryQueuesAttributesResponse]);
			jest.spyOn(DlqService.prototype, "getMessages").mockResolvedValue({ messages: [queryQueueMessagesResponse] });
			jest.spyOn(DlqService.prototype, "requeueMessages");
			jest.spyOn(DlqService.prototype, "deleteMessage");
			jest.spyOn(DlqService.prototype, "deleteMessages");

			req = {
				query: {},
				params: {}
			};

			res = {
				send: jest.fn(),
				status: jest.fn()
			};
		});

		it("healthcheck should respond with 200", async () => {
			await microscopeDlqHealthcheck(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.send).toHaveBeenCalledWith("OK");
		});

		it("query queues should return list of service queues", async () => {
			await queryQueues(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.send).toHaveBeenCalledWith([getQueuesResponse]);
		});

		it("query queue attributes should return list of attributes", async () => {
			await queryQueueAttributes(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.send).toHaveBeenCalledWith([queryQueuesAttributesResponse]);
		});

		it("query queue messages should return list of visible messages", async () => {
			req.params = { queueName };
			req.query.limit = 5;
			await queryQueueMessages(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.send).toHaveBeenCalledWith({
				messages: [queryQueueMessagesResponse]
			});
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
	}
});
