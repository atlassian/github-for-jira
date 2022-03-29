import { urlParamsMiddleware } from "./url-params-middleware";
import { AxiosRequestConfig } from "axios";

describe("URL Params Axios Middleware", () => {
	it("should return the same config if URL/BaseURL is undefined or empty string", () => {
		const config: AxiosRequestConfig = {
			params: { foo: "bar" }
		};
		expect(urlParamsMiddleware(config)).toMatchObject(config);
		config.url = "";
		expect(urlParamsMiddleware(config)).toMatchObject(config);
		config.baseURL = "";
		expect(urlParamsMiddleware(config)).toMatchObject(config);
	});

	it("should return the same config if there's no URLParams value is undefined", () => {
		const config: AxiosRequestConfig = {
			url: "/path",
			urlParams: { key: undefined }
		};
		expect(urlParamsMiddleware(config)).toMatchObject(config);
	});

	it("should save original URL", () => {
		const config: AxiosRequestConfig = {
			url: "/path",
			baseURL: jiraHost
		};
		expect(urlParamsMiddleware(config).originalUrl).toEqual(`${jiraHost}/path`);
		config.baseURL = undefined;
		expect(urlParamsMiddleware(config).originalUrl).toEqual(`/path`);
		config.baseURL = jiraHost;
		config.url = undefined;
		expect(urlParamsMiddleware(config).originalUrl).toEqual(jiraHost);
		config.url = "/{foo}";
		config.urlParams = { foo: "bar" };
		expect(urlParamsMiddleware(config).originalUrl).toEqual(`${jiraHost}/{foo}`);
	});

	it("should throw error if URL has param but missing variable in config", () => {
		const config: AxiosRequestConfig = {
			url: "/{foo}",
			baseURL: jiraHost
		};
		expect(() => urlParamsMiddleware(config)).toThrow();
		config.urlParams = { foo2: "bar" };
		expect(() => urlParamsMiddleware(config)).toThrow();
	});

	it("should replace path variables", () => {
		const config: AxiosRequestConfig = {
			url: "/{foo}/{owner}2",
			urlParams: {
				foo: "bar",
				owner: "person"
			}
		};
		expect(urlParamsMiddleware(config).url).toEqual("/bar/person2");
	});

	it("should replace query variables", () => {
		const config: AxiosRequestConfig = {
			url: "/foo?search={terms}",
			urlParams: {
				terms: "me"
			}
		};
		expect(urlParamsMiddleware(config).url).toEqual("/foo?search=me");
	});

	it("should replace multiple variables", () => {
		const config: AxiosRequestConfig = {
			url: "/{foo}/{foo}-owner",
			urlParams: {
				foo: "bar"
			}
		};
		expect(urlParamsMiddleware(config).url).toEqual("/bar/bar-owner");
	});

	it("should replace number variables", () => {
		const config: AxiosRequestConfig = {
			url: "/foo/{id}",
			urlParams: {
				id: 12345
			}
		};
		expect(urlParamsMiddleware(config).url).toEqual("/foo/12345");
	});

	it("should replace stringifyable variables", () => {
		const config: AxiosRequestConfig = {
			url: "/foo/{id}",
			urlParams: {
				id: { toString: () => "id-1234" }
			}
		};
		expect(urlParamsMiddleware(config).url).toEqual("/foo/id-1234");
	});

	it("should URL Encode all replaced variables", () => {
		const config: AxiosRequestConfig = {
			url: "/foo/{id}",
			urlParams: {
				id: "id 1234"
			}
		};
		expect(urlParamsMiddleware(config).url).toEqual("/foo/id%201234");
	});
});
