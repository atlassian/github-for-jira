/* eslint-disable @typescript-eslint/no-explicit-any */
import { LogMiddleware } from "./frontend-log-middleware";
import { Request, Response } from "express";
import Logger, { createLogger } from "bunyan";
import { Writable } from "stream";
import { wrapLogger } from "probot/lib/wrap-logger";

describe("frontend-log-middleware", () => {
	const request: { log: Logger | undefined } = { log: undefined };
	const response: any = { once: jest.fn() };
	let loggedStuff = "";

	beforeEach(() => {
		loggedStuff = "";
		request.log = wrapLogger(createLogger({
			name: "test",
			stream: new Writable({
				write: function(chunk, _, next) {
					loggedStuff += chunk.toString();
					next();
				}
			})
		}));
	});

	it("preserves old fields", async () => {
		request.log = request.log?.child({ foo: 123 });
		await new Promise((resolve => {
			LogMiddleware(request as Request, response as Response, () => {
				request.log?.info("hello");
				expect(loggedStuff).toContain("foo");
				expect(loggedStuff).toContain("123");
				resolve(0);
			});
		}));
	});
});
