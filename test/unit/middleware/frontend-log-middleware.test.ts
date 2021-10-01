import logMiddleware from "../../../src/middleware/frontend-log-middleware";
import { NextFunction, Request, Response } from "express";
import Logger from "bunyan";
import {Writable} from "stream";
import {wrapLogger} from "probot/lib/wrap-logger";

describe("frontend-log-middleware", () => {
	const request: { log: Logger | undefined } = { log: undefined }
	const response: any = { once: jest.fn() }
	const next: NextFunction = jest.fn();
	let loggedStuff = '';

	beforeEach(() => {
		loggedStuff = '';
		request.log = wrapLogger(Logger.createLogger({
			name: 'test',
			stream: new Writable({
				write: function(chunk, _, next) {
					loggedStuff += chunk.toString();
					next();
				}
			})
		}));
	})

	test("preserves old fields", () => {
		request.log = request.log!.child({foo: 123});
		logMiddleware(request as Request, response as Response, next);

		request.log.info('hello');
		expect(loggedStuff).toContain('foo');
		expect(loggedStuff).toContain(123);
	});
});
