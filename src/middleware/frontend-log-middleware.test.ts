/* eslint-disable @typescript-eslint/no-explicit-any */
import { LogMiddleware } from "./frontend-log-middleware";
import { Request, Response } from "express";
import Logger, { createLogger } from "bunyan";

describe("frontend-log-middleware", () => {
	const request: { log: Logger | undefined } = { log: undefined };
	const response: any = { once: jest.fn() };

	it("preserves old fields", async () => {
		request.log = createLogger({ name: "test", foo: 123 });

		await new Promise((resolve => {
			LogMiddleware(request as Request, response as Response, () => {
				request.log?.info("hello");
				expect(request.log?.fields?.foo).toBe(123);
				resolve(0);
			});
		}));
	});
});
