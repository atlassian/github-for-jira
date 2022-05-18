import axios, { AxiosRequestConfig } from "axios";
import fs from "fs";
import { jiraAuthMiddleware } from "./jira-auth-middleware";
import path from "path";

describe("Jira Auth Axios Middleware", () => {
	let middleware: (config: AxiosRequestConfig) => AxiosRequestConfig;
	let config: AxiosRequestConfig;
	const token = "JWT eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjAsImV4cCI6MTgwLCJpc3MiOiJjb20uZ2l0aHViLmludGVncmF0aW9uLnRlc3QtYXRsYXNzaWFuLWluc3RhbmNlIiwicXNoIjoiNzk5YmU4NGE3ZmEzNTU3MDA4NzE2M2MwY2Q5YWYzYWJmZjdhYzA1YzJjMTJiYTBiYjFkN2VlYmM5ODRiM2FjMiJ9.pxhdfKmiAhXGvH7rm-nKgMuvuhadlZTphziSQxHbIzU";

	beforeEach(() => {
		const instance = axios.create();
		const secret = fs.readFileSync(path.resolve(__dirname, "../../../test/setup/test-key.pem"), { encoding: "utf8" });
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
		expect(result.headers?.Authorization).toEqual("JWT eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjAsImV4cCI6MTgwLCJpc3MiOiJjb20uZ2l0aHViLmludGVncmF0aW9uLnRlc3QtYXRsYXNzaWFuLWluc3RhbmNlIiwicXNoIjoiY2MzMmNkZmRjZTM5YzA5YzY5N2Q5ZWI0NTJkZDYxOTkxMDVlZDAwNTM1NjI4OTU5ZTE1NjJlMGRhOTBmMDc4MiJ9.nbTpwmv8knxugYYLNUjPQtyYWx_3Pq1E0fJhX34vssk");
	});

	it("should generate different token when using params option", () => {
		config.params = {
			id: 1234
		};
		const result = middleware(config);
		expect(result.headers?.Authorization).not.toEqual(token);
		expect(result.headers?.Authorization).toEqual("JWT eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjAsImV4cCI6MTgwLCJpc3MiOiJjb20uZ2l0aHViLmludGVncmF0aW9uLnRlc3QtYXRsYXNzaWFuLWluc3RhbmNlIiwicXNoIjoiZGQ0ZmY5YWE0OGE0MTA3ZTc0YmZiZTEyMDhhZTAwMjc3ZmVmNjM3Yjg5MzJlZWM3OWEyM2VlMDg2N2Q2NzIxOCJ9.152vgnGF1Oq-6wnqhR40V9HvRspDT9V_q0BRMx50XPA");
	});

	it("should generate different token when changing issue date", () => {
		mockSystemTime(123456789);
		const result = middleware(config);
		expect(result.headers?.Authorization).not.toEqual(token);
		expect(result.headers?.Authorization).toEqual("JWT eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjEyMzQ1NiwiZXhwIjoxMjM2MzYsImlzcyI6ImNvbS5naXRodWIuaW50ZWdyYXRpb24udGVzdC1hdGxhc3NpYW4taW5zdGFuY2UiLCJxc2giOiI3OTliZTg0YTdmYTM1NTcwMDg3MTYzYzBjZDlhZjNhYmZmN2FjMDVjMmMxMmJhMGJiMWQ3ZWViYzk4NGIzYWMyIn0.kFVlsoXQxVMJCqRHPF7G6uQ1X629KYEqch0lRdrzikI");
	});
});
