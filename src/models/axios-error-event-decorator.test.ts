import axios from "axios";
import nock from "nock";
import { AxiosErrorEventDecorator } from "./axios-error-event-decorator";

describe("AxiosErrorDecorator", () => {
	const buildEvent = () => ({ extra: {}, tags: {} });
	const buildHint = (error) => ({ originalException: error });

	describe("GET 403", () => {
		let event;
		let hint;

		beforeEach(async () => {
			nock("https://www.example.com")
				.get("/foo/bar")
				.reply(403, undefined, { "X-Request-Id": "abcdef" });
			const error = await axios
				.get("https://www.example.com/foo/bar")
				.catch((error) => Promise.resolve(error));
			event = buildEvent();
			hint = buildHint(error);
		});

		it("adds response data", async () => {
			const decoratedEvent = AxiosErrorEventDecorator.decorate(event, hint);

			expect(decoratedEvent.extra?.response).toEqual({
				status: 403,
				headers: {
					"x-request-id": "abcdef"
				}
			});
		});

		it("adds request data", () => {
			const decoratedEvent = AxiosErrorEventDecorator.decorate(event, hint);

			expect(decoratedEvent.extra?.request).toMatchObject({
				method: "GET",
				path: "/foo/bar",
				host: "www.example.com",
				headers: {
					accept: "application/json, text/plain, */*",
					host: "www.example.com"
				}
			});
		});

		it("uses path and status for grouping", () => {
			const decoratedEvent = AxiosErrorEventDecorator.decorate(event, hint);

			expect(decoratedEvent.fingerprint).toEqual([
				"{{ default }}",
				403,
				"GET /foo/bar"
			]);
		});
	});

	describe("GET 403 alt", () => {
		let event;
		let hint;

		beforeEach(async () => {
			nock("https://www.example.com")
				.get("/foo/bar?hi=hello")
				.reply(403, undefined, { "X-Request-Id": "abcdef", "Content-Type": "application/json" });
			const error = await axios
				.get("https://www.example.com/foo/bar", { params: { hi: "hello" } })
				.catch((error) => Promise.resolve(error));

			event = buildEvent();
			hint = buildHint(error);
		});

		it("excludes query string from grouping", () => {
			const decoratedEvent = AxiosErrorEventDecorator.decorate(event, hint);

			expect(decoratedEvent.fingerprint).toEqual([
				"{{ default }}",
				403,
				"GET /foo/bar"
			]);
		});
	});

	describe("POST with JSON body", () => {
		let event;
		let hint;

		beforeEach(async () => {
			nock("https://www.example.com")
				.post("/foo/bar")
				.reply(
					401,
					"This is the really long body. This is the really long body. This is the really long body. This is the really long body. This is the really long body. This is the really long body. This is the really long body. This is the really long body. This is the really long body. This is the really long body."
				);
			const error = await axios
				.post("https://www.example.com/foo/bar", { hello: "hi" })
				.catch((error) => Promise.resolve(error));

			event = buildEvent();
			hint = buildHint(error);
		});

		it("adds truncated response body", () => {
			const decoratedEvent = AxiosErrorEventDecorator.decorate(event, hint);

			expect(decoratedEvent.extra?.response.body).toMatch(
				/^This is the really long body/
			);
			expect(decoratedEvent.extra?.response.body.length).toEqual(255);
		});

		it("adds parsed request body", () => {
			const decoratedEvent = AxiosErrorEventDecorator.decorate(event, hint);

			expect(decoratedEvent.extra?.request.body).toEqual({ hello: "hi" });
		});
	});

	describe("POST with form body", () => {
		let event;
		let hint;

		beforeEach(async () => {
			nock("https://www.example.com").post("/foo/bar").reply(401);
			const error = await axios
				.post("https://www.example.com/foo/bar", "hi=hello")
				.catch((error) => Promise.resolve(error));

			event = buildEvent();
			hint = buildHint(error);
		});

		it("adds raw request body", () => {
			const decoratedEvent = AxiosErrorEventDecorator.decorate(event, hint);

			expect(decoratedEvent.extra?.request.body).toEqual("hi=hello");
		});
	});

	describe("Given a generic error", () => {
		it("does nothing", () => {
			const event = buildEvent();
			const hint = buildHint(new Error("boom"));

			const decoratedEvent = AxiosErrorEventDecorator.decorate(event, hint);

			expect(decoratedEvent.extra?.response).toEqual(undefined);
			expect(decoratedEvent.extra?.request).toEqual(undefined);
		});
	});
});
