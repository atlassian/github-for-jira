import { statsd }  from "config/statsd";
import { jiraAndGitHubErrorsHandler, webhookMetricWrapper } from "./error-handlers";
import { getLogger } from "config/logger";
import { JiraClientError } from "../jira/client/axios";
import { Octokit } from "@octokit/rest";
import { GithubClientRateLimitingError } from "../github/client/github-client-errors";
import { AxiosError, AxiosResponse, AxiosResponseHeaders } from "axios";
import { ErrorHandlingResult, SQSMessageContext, BaseMessagePayload } from "~/src/sqs/sqs.types";

describe("error-handlers", () => {

	let statsdIncrementSpy: any;

	beforeEach(() => {
		// Lock Time
		statsdIncrementSpy = jest.spyOn(statsd, "increment");
		jest.useFakeTimers("modern").setSystemTime(new Date("2020-01-01").getTime());
	});

	afterEach(() => {
		// Unlock Time
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		statsdIncrementSpy.mockRestore();
		jest.useRealTimers();
	});

	const mockPayload = {
		repository: {
			id: 0,
			name: "string",
			full_name: "string",
			html_url: "string",
			owner: "string"
		},
		shas: [],
		jiraHost: "string",
		installationId: 0,
		webhookId: "string"
	};

	const createContext = (receiveCount: number, lastAttempt: boolean): SQSMessageContext<BaseMessagePayload> =>
		({
			receiveCount, lastAttempt, log: getLogger("test"), message: {}, payload: mockPayload
		});

	describe("jiraOktokitErrorHandler", () => {

		it("Returns normal retry when error is unknown", async () => {

			const result = await jiraAndGitHubErrorsHandler(new Error(), createContext(1, false));

			expect(result.retryable).toBe(true);
			expect(result.retryDelaySec).toBe(3 * 60);
			expect(result.isFailure).toBe(true);
		});

		it("Exponential backoff works", async () => {

			const result = await jiraAndGitHubErrorsHandler(new Error(), createContext(3, false));

			expect(result.retryable).toBe(true);
			expect(result.retryDelaySec).toBe(27 * 60);
			expect(result.isFailure).toBe(true);
		});

		const getJiraClientError = (code: number) => {
			return new JiraClientError("err", {
				message: "",
				name: "",
				config: {}, isAxiosError: true, toJSON: () => ({})
			}, code);
		};

		it("Unretryable and not an error on Jira 401", async () => {

			const result = await jiraAndGitHubErrorsHandler(getJiraClientError(401), createContext(1, true));
			expect(result.retryable).toBe(false);
			expect(result.isFailure).toBe(false);
		});

		it("Unretryable and not an error on Jira 403", async () => {

			const result = await jiraAndGitHubErrorsHandler(getJiraClientError(403), createContext(1, true));
			expect(result.retryable).toBe(false);
			expect(result.isFailure).toBe(false);
		});

		it("Unretryable and not an error on Jira 404", async () => {

			const result = await jiraAndGitHubErrorsHandler(getJiraClientError(404), createContext(1, true));
			expect(result.retryable).toBe(false);
			expect(result.isFailure).toBe(false);
		});

		it("Retryable and error on Jira 500", async () => {

			const result = await jiraAndGitHubErrorsHandler(getJiraClientError(500), createContext(1, true));
			expect(result.retryable).toBe(true);
			expect(result.isFailure).toBe(true);
		});

		it("Retryable with proper delay on Rate Limiting - receiveCount 1", async () => {
			const headers: AxiosResponseHeaders = { "x-ratelimit-reset": `${Math.floor(new Date("2020-01-01").getTime() / 1000) + 100}` };
			const mockedResponse = { status: 403, headers: headers } as AxiosResponse;

			const result = await jiraAndGitHubErrorsHandler(
				new GithubClientRateLimitingError({
					response: mockedResponse
				} as AxiosError),

				createContext(1, false)
			);

			expect(result.retryable).toBe(true);
			//Make sure delay is equal to recommended delay + 50 seconds
			expect(result.retryDelaySec).toBe(150);
			expect(result.isFailure).toBe(true);
		});

		it("Retryable with proper delay on Rate Limiting - receiveCount 3", async () => {
			const headers: AxiosResponseHeaders = { "x-ratelimit-reset": `${Math.floor(new Date("2020-01-01").getTime() / 1000) + 100}` };
			const mockedResponse = { status: 403, headers: headers } as AxiosResponse;

			const result = await jiraAndGitHubErrorsHandler(
				new GithubClientRateLimitingError({
					response: mockedResponse
				} as AxiosError),

				createContext(3, false)
			);

			expect(result.retryable).toBe(true);
			//Make sure delay is equal to recommended delay + 50 seconds
			expect(result.retryDelaySec).toBe(7330);
			expect(result.isFailure).toBe(true);
		});

		it("Retryable with proper delay on Rate Limiting - receiveCount 5", async () => {
			const headers: AxiosResponseHeaders = { "x-ratelimit-reset": `${Math.floor(new Date("2020-01-01").getTime() / 1000) + 100}` };
			const mockedResponse = { status: 403, headers: headers } as AxiosResponse;

			const result = await jiraAndGitHubErrorsHandler(
				new GithubClientRateLimitingError({
					response: mockedResponse
				} as AxiosError),

				createContext(5, false)
			);

			expect(result.retryable).toBe(true);
			expect(result.retryDelaySec).toBe(14510);
			expect(result.isFailure).toBe(true);
		});

		it("Unretryable and not an error on OctokitError 401", async () => {

			const error: Octokit.HookError = { ...new Error("Err"), status: 401, headers: {} };

			const result = await jiraAndGitHubErrorsHandler(error, createContext(1, true));
			expect(result.retryable).toBe(false);
			expect(result.isFailure).toBe(false);
		});

		it("Unretryable and error on OctokitError 500", async () => {

			const error: Octokit.HookError = { ...new Error("Err"), status: 500, headers: {} };

			const result = await jiraAndGitHubErrorsHandler(error, createContext(1, true));
			expect(result.retryable).toBe(true);
			expect(result.isFailure).toBe(true);
		});
	});


	describe("webhookMetricWrapper", () => {

		it("Doesn't sent metric for a non-error case when not retryable", async () => {

			const mockedResponse: ErrorHandlingResult = { retryable: false, isFailure: false };
			const handlerUnderTest = webhookMetricWrapper(() => Promise.resolve(mockedResponse), "test");

			const result = await handlerUnderTest(new Error(), createContext(1, false));
			expect(result).toBe(mockedResponse);
			expect(statsdIncrementSpy).toBeCalledTimes(0);
		});

		it("Doesn't sent metric for a non-error case when lastAttempt", async () => {

			const mockedResponse: ErrorHandlingResult = { retryable: true, isFailure: false };
			const handlerUnderTest = webhookMetricWrapper(() => Promise.resolve(mockedResponse), "test");

			const result = await handlerUnderTest(new Error(), createContext(3, true));
			expect(result).toBe(mockedResponse);
			expect(statsdIncrementSpy).toBeCalledTimes(0);
		});

		it("Doesn't sent metric for an error when retryable but not last attempt", async () => {

			const mockedResponse: ErrorHandlingResult = { retryable: true, isFailure: true };
			const handlerUnderTest = webhookMetricWrapper(() => Promise.resolve(mockedResponse), "test");

			const result = await handlerUnderTest(new Error(), createContext(2, false));
			expect(result).toBe(mockedResponse);
			expect(statsdIncrementSpy).toBeCalledTimes(0);
		});

		it("Sends metric for an error case when not retryable", async () => {

			const mockedResponse: ErrorHandlingResult = { retryable: false, isFailure: true };
			const handlerUnderTest = webhookMetricWrapper(() => Promise.resolve(mockedResponse), "test");

			const result = await handlerUnderTest(new Error(), createContext(1, false));
			expect(result).toBe(mockedResponse);
			expect(statsdIncrementSpy).toBeCalledTimes(1);
		});

		it("Sends metric for a non-error case when lastAttempt", async () => {

			const mockedResponse: ErrorHandlingResult = { retryable: true, isFailure: true };
			const handlerUnderTest = webhookMetricWrapper(() => Promise.resolve(mockedResponse), "test");

			const result = await handlerUnderTest(new Error(), createContext(3, true));
			expect(result).toBe(mockedResponse);
			expect(statsdIncrementSpy).toBeCalledTimes(1);
		});
	});
});
