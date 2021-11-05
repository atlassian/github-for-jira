/* eslint-disable @typescript-eslint/no-explicit-any */
import logMiddleware from "../../../src/middleware/frontend-log-middleware";
import Logger from "bunyan";
import {Writable} from "stream";
import {wrapLogger} from "probot/lib/wrap-logger";

describe("frontend-log-middleware", () => {
	const request = { log: undefined } as any;
	const response = { once: jest.fn() } as any;
	let loggedStuff = "";

	beforeEach(() => {
		loggedStuff = "";
		request.log = wrapLogger(Logger.createLogger({
			name: "test",
			stream: new Writable({
				write: function(chunk, _, next) {
					loggedStuff += chunk.toString();
					next();
				}
			})
		}));
	})

	test("preserves old fields", async () => {
		request.log = request.log?.child({foo: 123});
		await new Promise((resolve => {
			logMiddleware(request, response, () => {
				request.log?.info("hello");
				expect(loggedStuff).toContain("foo");
				expect(loggedStuff).toContain(123);
				resolve(0);
			});
		}))
	});
});
