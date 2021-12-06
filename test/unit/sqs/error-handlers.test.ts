import statsd from "../../../src/config/statsd";
import {jiraOctokitErrorHandler} from "../../../src/sqs/error-handlers";
import {Context} from "../../../src/sqs/index";
import {getLogger} from "../../../src/config/logger";
import {JiraClientError} from "../../../src/jira/client/axios";
import {RateLimitingError as OldRateLimitingError} from "../../../src/config/enhance-octokit";
import {Octokit} from "probot";
import {RateLimitingError} from "../../../src/github/client/errors";
import {AxiosError} from "axios";


describe("jiraOktokitErrorHandler", () => {

	let statsdIncrementSpy = jest.spyOn(statsd, "histogram");

	beforeEach(() => {
		// Lock Time
		statsdIncrementSpy = jest.spyOn(statsd, "increment");
		jest.useFakeTimers("modern").setSystemTime(new Date("2020-01-01").getTime());
	});

	afterEach(() => {
		// Unlock Time
		statsdIncrementSpy.mockRestore();
		jest.useRealTimers();
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

	const createContext = (receiveCount: number, lastAttempt: boolean): Context<any> =>
		({
			receiveCount, lastAttempt, log: getLogger("test"), message: {}, payload: mockPayload
		})


	it("Returns normal retry when error is unknown", async () => {

		const result = await jiraOctokitErrorHandler(new Error(), createContext(1, false));

		expect(result.retryable).toBe(true)
		expect(result.retryDelaySec).toBe(3*60)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Exponential backoff works", async () => {

		const result = await jiraOctokitErrorHandler(new Error(), createContext(3, false));

		expect(result.retryable).toBe(true)
		expect(result.retryDelaySec).toBe(27*60)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Sends metrics when it was last attempt", async () => {

		await jiraOctokitErrorHandler(new Error(), createContext(1, true));

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

		const result = await jiraOctokitErrorHandler(getJiraClientError(401), createContext(1, true));
		expect(result.retryable).toBe(false)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Unretryable and no failure metric on Jira 403", async () => {

		const result = await jiraOctokitErrorHandler(getJiraClientError(403), createContext(1, true));
		expect(result.retryable).toBe(false)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Unretryable and no failure metric on Jira 404", async () => {

		const result = await jiraOctokitErrorHandler(getJiraClientError(404), createContext(1, true));
		expect(result.retryable).toBe(false)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Retryable and no failure metric sent on Jira 500", async () => {

		const result = await jiraOctokitErrorHandler(getJiraClientError(500), createContext(1, true));
		expect(result.retryable).toBe(true)
		expect(statsdIncrementSpy).toBeCalledTimes(1);
	});

	it("Retryable with proper delay on Rate Limiting (old)", async () => {
		const result = await jiraOctokitErrorHandler(new OldRateLimitingError(Math.floor(new Date("2020-01-01").getTime()/1000) + 100), createContext(1, false));
		expect(result.retryable).toBe(true)
		//Make sure delay is equal to recommended delay + 10 seconds
		expect(result.retryDelaySec).toBe(110)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Retryable with proper delay on Rate Limiting", async () => {
		const result = await jiraOctokitErrorHandler(new RateLimitingError(
			Math.floor(new Date("2020-01-01").getTime()/1000) + 100,
			0, {} as AxiosError
		), createContext(1, false));
		expect(result.retryable).toBe(true)
		//Make sure delay is equal to recommended delay + 10 seconds
		expect(result.retryDelaySec).toBe(110)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Unretryable and no failure metric on OctokitError 401", async () => {

		const error : Octokit.HookError = {...new Error("Err"), status: 401, headers: {}}

		const result = await jiraOctokitErrorHandler(error, createContext(1, true));
		expect(result.retryable).toBe(false)
		expect(statsdIncrementSpy).toBeCalledTimes(0);
	});

	it("Retryable and emits failure metrics on OctokitError 500", async () => {

		const error : Octokit.HookError = {...new Error("Err"), status: 500, headers: {}}

		const result = await jiraOctokitErrorHandler(error, createContext(1, true));
		expect(result.retryable).toBe(true)
		expect(statsdIncrementSpy).toBeCalledTimes(1);
	});
});
