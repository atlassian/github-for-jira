/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */
import url from "url";
import { Event, EventHint } from "@sentry/types";

/*
 * Adds request/response metadata to a Sentry event for an Axios error
 * To use, pass AxiosErrorEventDecorator.decorate to scope.addEventProcessor
 *
 * See https://docs.sentry.io/platforms/node/#eventprocessors
 */
export interface AxiosErrorDecoratorEvent extends Event {
	extra?: Record<string, any>;
}

export class AxiosErrorEventDecorator {
	event: any;
	hint: any;

	constructor(event: unknown, hint: unknown) {
		this.event = event;
		this.hint = hint;
	}

	get error(): any {
		return this.hint?.originalException;
	}

	get response(): any {
		return this.error?.response;
	}

	get request(): any {
		return this.response?.request;
	}

	static decorate(event: Event, hint?: EventHint | undefined): AxiosErrorDecoratorEvent {
		return new AxiosErrorEventDecorator(event, hint).decorate();
	}

	validError(): boolean {
		return this.error && this.response && this.request;
	}

	decorate(): Event {
		if (!this.validError()) {
			return this.event;
		}

		this.event.extra.response = this.responseMetadata();
		this.event.extra.request = this.requestMetadata();
		this.event.fingerprint = this.generateFingerprint();

		return this.event;
	}

	requestMetadata() {
		return {
			method: this.request?.method,
			path: this.request?.path,
			host: this.request?.getHeader("host"),
			headers: this.request?.getHeaders(),
			body: this.parseRequestBody(this.response?.config?.data)
		};
	}

	responseMetadata() {
		return {
			status: this.response?.status,
			headers: this.response?.headers,
			body: this.response?.data ? this.response.data.toString().slice(0, 255) : undefined
		};
	}

	generateFingerprint() {
		const { pathname } = url.parse(this.request?.path || "");

		return [
			"{{ default }}",
			this.response?.status,
			`${this.request?.method as string} ${pathname ?? "undefined"}`
		];
	}

	/*
	 * Parse JSON body, when present and valid, otherwise return unparsed body.
	 */
	parseRequestBody(body) {
		if (body && this.isJsonRequest()) {
			try {
				return JSON.parse(body);
			} catch (err: unknown) {
				const error = err as { name?: string };
				if (error.name !== "SyntaxError") {
					throw error;
				}
			}
		}

		return body;
	}

	isJsonRequest() {
		return this.request
			?.getHeader("content-type")
			?.startsWith("application/json");
	}
}
