import axios, { AxiosRequestConfig } from "axios";
import fs from "fs";
import { jiraAuthMiddleware } from "../../../../src/util/axios/jira-auth-middleware";
import path from "path";

describe("Jira Auth Axios Middleware", () => {
	let middleware: (config: AxiosRequestConfig) => AxiosRequestConfig;
	let config: AxiosRequestConfig;
	const token = "JWT eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjAsImV4cCI6MzAsImlzcyI6ImNvbS5naXRodWIuaW50ZWdyYXRpb24udGVzdC1hdGxhc3NpYW4taW5zdGFuY2UiLCJxc2giOiI3OTliZTg0YTdmYTM1NTcwMDg3MTYzYzBjZDlhZjNhYmZmN2FjMDVjMmMxMmJhMGJiMWQ3ZWViYzk4NGIzYWMyIn0.yXI3QdqBT4QBIKtgG6Vh3-plOr52XCXNA2nHNVXfTig";

	beforeEach(() => {
		const instance = axios.create();
		const secret = fs.readFileSync(path.resolve(__dirname, "../../../setup/test-key.pem"), { encoding: "utf8" });
		middleware = jiraAuthMiddleware(secret, instance);
		mockSystemTime(0);
		config = {
			baseURL: jiraHost,
			url: "/path"
		};
	});

	it("should generate auth token based on url", () => {
		expect(middleware(config)).toMatchObject({
			...config,
			headers: {
				Authorization: token
			}
		});
	});

	it("should not override config headers", () => {
		const headers = {
			Accept: "text/json"
		};
		expect(middleware({
			...config,
			headers
		})).toMatchObject({
			...config,
			headers: {
				...headers,
				Authorization: token
			}
		});
	});

	it("should generate different token when using changing path", () => {
		config.url += "/foo";
		const result = middleware(config);
		expect(result.headers?.Authorization).not.toEqual(token);
		expect(result.headers?.Authorization).toEqual("JWT eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjAsImV4cCI6MzAsImlzcyI6ImNvbS5naXRodWIuaW50ZWdyYXRpb24udGVzdC1hdGxhc3NpYW4taW5zdGFuY2UiLCJxc2giOiJjYzMyY2RmZGNlMzljMDljNjk3ZDllYjQ1MmRkNjE5OTEwNWVkMDA1MzU2Mjg5NTllMTU2MmUwZGE5MGYwNzgyIn0.MK52x4P0k2eqHlUlCI8-ZWfn_qE1Q53ZbGsI63_VhEc");
	});

	it("should generate different token when using params option", () => {
		config.params = {
			id: 1234
		};
		const result = middleware(config);
		expect(result.headers?.Authorization).not.toEqual(token);
		expect(result.headers?.Authorization).toEqual("JWT eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjAsImV4cCI6MzAsImlzcyI6ImNvbS5naXRodWIuaW50ZWdyYXRpb24udGVzdC1hdGxhc3NpYW4taW5zdGFuY2UiLCJxc2giOiJkZDRmZjlhYTQ4YTQxMDdlNzRiZmJlMTIwOGFlMDAyNzdmZWY2MzdiODkzMmVlYzc5YTIzZWUwODY3ZDY3MjE4In0.mT-JyFgpdJDhf8P1qsrpG1gaeJW4xPDr1VntHDNqhvI");
	});

	it("should generate different token when changing issue date", () => {
		mockSystemTime(123456789);
		const result = middleware(config);
		expect(result.headers?.Authorization).not.toEqual(token);
		expect(result.headers?.Authorization).toEqual("JWT eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjEyMzQ1NiwiZXhwIjoxMjM0ODYsImlzcyI6ImNvbS5naXRodWIuaW50ZWdyYXRpb24udGVzdC1hdGxhc3NpYW4taW5zdGFuY2UiLCJxc2giOiI3OTliZTg0YTdmYTM1NTcwMDg3MTYzYzBjZDlhZjNhYmZmN2FjMDVjMmMxMmJhMGJiMWQ3ZWViYzk4NGIzYWMyIn0.iL3x3RFljJrgKrMz9UDJ2wcRBlt7N-ETARzlt5lgWEg");
	});
});
