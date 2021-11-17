import statsd from "../../../src/config/statsd";
import {pushQueueErrorHandler, PushQueueMessagePayload} from "../../../src/sqs/push";
import {Context} from "../../../src/sqs/index";
import {getLogger} from "../../../src/config/logger";
import {JiraClientError} from "../../../src/jira/client/axios";


describe("Push Queue Error Handler", () => {


	let statsdIncrementSpy = jest.spyOn(statsd, "histogram");

	beforeAll(() => {
		// Lock Time
		statsdIncrementSpy = jest.spyOn(statsd, "increment");
	});

	afterAll(() => {
		// Unlock Time
		statsdIncrementSpy.mockRestore();
	});

	const mockPayload = {
		repository: {
			id: 0,
			name: "string",
			full_name: "string",
			html_url: "string",
			owner: "string",
		},
		shas: [],
		jiraHost: "string",
		installationId: 0,
		webhookId: "string"
	};

	const createContext = (receiveCount: number, lastAttempt: boolean): Context<PushQueueMessagePayload> =>
		({
			receiveCount, lastAttempt, log: getLogger("test"), message: {}, payload: mockPayload
		})


	it("Returns normal retry when error is unknown", async () => {

		const result = await pushQueueErrorHandler(new Error(), createContext(1, false));

		expect(result.retryable).toBe(true)
		expect(result.retryDelaySec).toBe(3*60)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Exponential backoff works", async () => {

		const result = await pushQueueErrorHandler(new Error(), createContext(3, false));

		expect(result.retryable).toBe(true)
		expect(result.retryDelaySec).toBe(27*60)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Sends metrics when it was last attempt", async () => {

		await pushQueueErrorHandler(new Error(), createContext(1, true));

		expect(statsdIncrementSpy).toBeCalledTimes(1);
	});


	function getJiraClientError(code: number) {
		return new JiraClientError("err", {
			message: "",
			name: "",
			config: {}, isAxiosError: true, toJSON: () => ({})
		}, code);
	}

	it("Unretryable and no failure metric on Jira 401", async () => {

		const result = await pushQueueErrorHandler(getJiraClientError(401), createContext(1, true));
		expect(result.retryable).toBe(false)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Unretryable and no failure metric on Jira 403", async () => {

		const result = await pushQueueErrorHandler(getJiraClientError(403), createContext(1, true));
		expect(result.retryable).toBe(false)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Unretryable and no failure metric on Jira 404", async () => {

		const result = await pushQueueErrorHandler(getJiraClientError(404), createContext(1, true));
		expect(result.retryable).toBe(false)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Retryable and no failure metric sent on Jira 500", async () => {

		const result = await pushQueueErrorHandler(getJiraClientError(500), createContext(1, true));
		expect(result.retryable).toBe(true)
		expect(statsdIncrementSpy).toBeCalledTimes(1);
	});
	
})
