/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */
import url from "url";
/*
 * Adds request/response metadata to a Sentry event for an Axios error
 * To use, pass AxiosErrorEventDecorator.decorate to scope.addEventProcessor
 *
 * See https://docs.sentry.io/platforms/node/#eventprocessors
 */
export default class AxiosErrorEventDecorator {
	event: any;
	hint: any;

	constructor(event: unknown, hint: unknown) {
		this.event = event;
		this.hint = hint;
	}

	get error() {
		return this.hint.originalException;
	}

	get response() {
		return this.error.response;
	}

	get request() {
		return this.response.request;
	}

	static decorate(event: any, hint: any): any {
		return new AxiosErrorEventDecorator(event, hint).decorate();
	}

	validError() {
		return this.error && this.response && this.request;
	}

	decorate(): unknown {
		if (!this.validError()) {
			return this.event;
		}

		this.event.extra.response = this.responseMetadata();
		this.event.extra.request = this.requestMetadata();
		this.event.fingerprint = this.generateFingerprint();

		return this.event;
	}

	requestMetadata() {
		const body = this.response.config.data;
		return {
			method: this.request.method,
			path: this.request.path,
			host: this.request.getHeader("host"),
			headers: this.request.getHeaders(),
			body: body ? this.parseRequestBody(body) : undefined
		};
	}

	responseMetadata() {
		return {
			status: this.response.status,
			headers: this.response.headers,
			body: this.response.data?.toString().slice(0, 255)
		};
	}

	generateFingerprint() {
		const { pathname } = url.parse(this.request.path);

		return [
			"{{ default }}",
			this.response.status,
			`${this.request.method} ${pathname}`
		];
	}

	/*
	 * Parse JSON body, when present and valid, otherwise return unparsed body.
	 */
	parseRequestBody(body) {
		if (this.isJsonRequest()) {
			try {
				return JSON.parse(body);
			} catch (error) {
				if (error.name !== "SyntaxError") {
					throw error;
				}
			}
		}

		return body;
	}

	isJsonRequest() {
		return this.request
			.getHeader("content-type")
			.startsWith("application/json");
	}
}
