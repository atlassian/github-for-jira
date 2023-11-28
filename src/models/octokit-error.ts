import { SentryScopeProxy } from "./sentry-scope-proxy";
import { Octokit } from "@octokit/rest";

/*
 * Wraps an Octokit HttpError and extracts metadata for Sentry.
 *
 * Intended to be used by `octokit.hook.wrap('request')`
 */
export class OctokitError extends Error {
	sentryScope: SentryScopeProxy;
	requestOptions: Octokit.HookOptions;
	httpError: Octokit.HookError;

	constructor(httpError: Octokit.HookError, requestOptions: Octokit.HookOptions) {
		super(`${requestOptions.method} ${requestOptions.url} responded with ${httpError.status}`);

		this.name = this.constructor.name;
		this.httpError = httpError;
		this.requestOptions = requestOptions;

		this.sentryScope = new SentryScopeProxy();
		this.sentryScope.extra.request = this.requestMetadata();
		this.sentryScope.extra.response = this.responseMetadata();
		this.sentryScope.fingerprint = this.generateFingerprint();
	}

	get responseCode() {
		return this.httpError.status;
	}

	requestMetadata = () => ({
		method: this.requestOptions.method,
		path: this.requestOptions.url,
		headers: this.requestOptions.headers
	});

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	responseMetadata = () => ({
		code: this.responseCode,
		body: this.deserializeMessage(this.httpError.message),
		headers: this.httpError.headers
	});

	generateFingerprint = () => [
		"{{ default }}",
		this.requestOptions.method,
		this.requestOptions.url,
		this.responseCode
	];

	deserializeMessage(message) {
		try {
			return JSON.parse(message);
		} catch (err: unknown) {
			const error = err as Error;
			if (error.name !== "SyntaxError") {
				throw error;
			}
		}

		return message;
	}
}
