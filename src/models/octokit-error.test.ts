/* eslint-disable @typescript-eslint/no-explicit-any */
import { Octokit } from "probot";
import { OctokitError } from "./octokit-error";

const buildHttpError = (message: string, code?: number, headers?: any) => {
	const error = new Error(message) as Octokit.HookError;

	error.status = code || 400;
	error.headers = headers || {};

	return error;
};

describe("OctokitError", () => {
	it("adds request metadata", () => {
		const error = buildHttpError("ServerError", 403);
		const requestOptions: any = {
			headers: { accept: "application/vnd.github.v3+json" },
			method: "GET",
			url: "/users/:username"
		};

		const octokitError = new OctokitError(error, requestOptions);

		expect(octokitError.sentryScope.extra.request).toEqual({
			method: "GET",
			path: "/users/:username",
			headers: { accept: "application/vnd.github.v3+json" }
		});
	});

	it("adds response metadata", () => {
		const requestOptions: any = {};
		const error = buildHttpError(
			"Server error",
			403,
			{ "x-github-request-id": "E553:6597:B5C6C1:1623C44:5D7192D1" }
		);

		const octokitError = new OctokitError(error, requestOptions);

		expect(octokitError.sentryScope.extra.response).toEqual({
			code: 403,
			body: "Server error",
			headers: { "x-github-request-id": "E553:6597:B5C6C1:1623C44:5D7192D1" }
		});
	});

	it("deserializes JSON response body", () => {
		const requestOptions: any = {};
		const error = buildHttpError(JSON.stringify({
			message: "API rate limit exceeded for installation ID 1339471.",
			documentation_url: "https://developer.github.com/v3/#rate-limiting"
		}));

		const octokitError = new OctokitError(error, requestOptions);

		expect(octokitError.sentryScope.extra.response.body).toEqual({
			message: "API rate limit exceeded for installation ID 1339471.",
			documentation_url: "https://developer.github.com/v3/#rate-limiting"
		});
	});

	it("sets the message", () => {
		const requestOptions: any = {
			method: "GET",
			url: "/users/:username"
		};
		const error = buildHttpError(
			JSON.stringify({
				message: "API rate limit exceeded for installation ID 1339471.",
				documentation_url: "https://developer.github.com/v3/#rate-limiting"
			}),
			401
		);

		const octokitError = new OctokitError(error, requestOptions);
		expect(octokitError.message).toEqual("GET /users/:username responded with 401");
	});

	it("sets fingerprint using method, path, and response code", () => {
		const requestOptions: any = { method: "GET", url: "/users/:username" };
		const error = buildHttpError("Server error", 401);

		const octokitError = new OctokitError(error, requestOptions);

		expect(octokitError.sentryScope.fingerprint).toEqual([
			"{{ default }}",
			"GET",
			"/users/:username",
			401
		]);
	});
});
