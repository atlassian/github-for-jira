import { logCurlOutputInChunks, runCurl } from "./curl-utils";
import { getLogger } from "config/logger";
describe("curl-utils", () => {
	describe("runCurl", () => {
		it("should successfully return correct data for GET", async () => {
			const result = await runCurl({
				fullUrl: `https://www.atlassian.com`,
				method: "GET",
				authorization: "secrets"
			});
			expect(result.meta).toContain("> GET / HTTP");
			expect(result.body).toContain("<!DOCTYPE html>");
			expect(result.meta).toContain("< HTTP/2 200");
		});
		it("should successfully return correct data for POST", async () => {
			const result = await runCurl({
				fullUrl: `https://www.atlassian.com`,
				method: "POST",
				authorization: "secrets"
			});
			expect(result.meta).toContain("> POST / HTTP");
			expect(result.body).toEqual(expect.stringContaining("403"));
			expect(result.meta).toContain("< HTTP/2 403");
		});
		it("should not contains private information in the headers", async () => {
			const result = await runCurl({
				fullUrl: `https://www.atlassian.com`,
				method: "GET",
				authorization: "secrets with spaces in it secrets"
			});
			expect(result.meta).not.toContain("secrets");
			expect(result.meta).toContain("< set-cookie: *******");
		});
	});

	describe("logCurlOutput", () => {
		it("should not explode with empty output", () => {
			expect(() => { logCurlOutputInChunks({ body: "", meta: "" }, getLogger("test")); }).not.toThrowError();
		});

		it("should not explode with non-empty output", async () => {
			const result = await runCurl({
				fullUrl: `https://www.atlassian.com`,
				method: "GET",
				authorization: "secrets"
			});
			expect(() => { logCurlOutputInChunks(result, getLogger("test")); }).not.toThrowError();
		});
	});
});
