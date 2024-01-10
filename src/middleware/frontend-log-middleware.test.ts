/* eslint-disable @typescript-eslint/no-explicit-any */
import { LogMiddleware } from "./frontend-log-middleware";
import { Request, Response } from "express";
import { createLogger, DEBUG } from "bunyan";
import { when } from "jest-when";
import { stringFlag, StringFlags } from "config/feature-flags";
import { postInstallUrl } from "routes/jira/atlassian-connect/jira-atlassian-connect-get";

jest.mock("config/feature-flags");

describe("frontend-log-middleware", () => {
	let request: Request;
	let response: Response;
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	const next = () => {
	};

	beforeEach(() => {
		request = {
			log: createLogger({ name: "test", foo: 123 }),
			session: {},
			cookies: {},
			headers: {},
			query: {}
		} as Request;

		response = {
			once: jest.fn(),
			locals: {}
		} as unknown as Response;
	});

	it("preserves old fields", async () => {
		await LogMiddleware(request, response, next);
		expect(request.log.fields?.foo).toBe(123);
	});

	describe("log level FF", () => {
		beforeEach(() => {
			when(stringFlag)
				.calledWith(StringFlags.LOG_LEVEL, expect.anything(), jiraHost)
				.mockResolvedValue("debug");
		});

		it("should set the correct level with jirahost in session", async () => {
			request.session.jiraHost = jiraHost;
			await LogMiddleware(request, response, next);
			expect(request.log.level()).toBe(DEBUG);
		});

		it("should set the correct level with jirahost in cookies", async () => {
			request.cookies.jiraHost = jiraHost;
			await LogMiddleware(request, response, next);
			expect(request.log.level()).toBe(DEBUG);
		});

		it("should set the correct level with jirahost from xdm_e", async () => {
			request.query.xdm_e = jiraHost;
			request.path = postInstallUrl;
			request.method = "GET";
			await LogMiddleware(request, response, next);
			expect(request.log.level()).toBe(DEBUG);
		});

		it("should set the correct level with jirahost from body", async () => {
			request.body = { jiraHost };
			request.path = postInstallUrl;
			request.method = "POST";
			await LogMiddleware(request, response, next);
			expect(request.log.level()).toBe(DEBUG);
		});
	});
});
