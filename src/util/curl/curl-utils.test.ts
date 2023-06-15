import { runCurl } from "./curl-utils";

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
		expect(result.body).toEqual("");
		expect(result.meta).toContain("< HTTP/2 302");
	});
	it("should not contains private information in the headers", async () => {
		const result = await runCurl({
			fullUrl: `https://www.atlassian.com`,
			method: "GET",
			authorization: "secrets"
		});
		expect(result.meta).not.toContain("secrets");
		expect(result.meta).not.toContain("set-cookie");
	});
});
