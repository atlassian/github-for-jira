import { validateUrl } from "utils/validate-url";

describe("validateUrl", () => {
	it("should return VALID for valid URLs", async () => {
		expect(validateUrl("http://myvalidurl.com").isValidUrl).toBeTruthy();
		expect(validateUrl("https://myvalidurl.net").isValidUrl).toBeTruthy();
		expect(validateUrl("https://192.213.23.12/branch/mypage").isValidUrl).toBeTruthy();
		expect(validateUrl("https://192.213.23.12:8080/branch/mypage").isValidUrl).toBeTruthy();
	});

	it("should return INVALID for unsupported protocol", async () => {
		expect(validateUrl("accd://thatsnotavalidprotocol")).toEqual({
			isValidUrl: false,
			reason: "unsupported protocol, only HTTP and HTTPS are allowed"
		});
	});

	it("should return INVALID for corrupted URL", () => {
		expect(validateUrl("thisaintaurlatall")).toEqual({
			isValidUrl: false
		});
		expect(validateUrl("www.wheresmyprotocol.com")).toEqual({
			isValidUrl: false
		});
	});

	it("should return INVALID invalid port", () => {
		expect(validateUrl("http://foo.com:12345")).toEqual({
			isValidUrl: false,
			reason: "only the following ports are allowed: 80, 8080, 443, 6017, 8443, 8444, 7990, 8090, 8085, 8060, 8900, 9900"
		});
	});

	it("should return INVALID if url has query parameters", async () => {
		expect(validateUrl("https://192.213.23.12/branch/mypage/?foo=bar")).toEqual({
			isValidUrl: false,
			reason: "query parameters are not allowed"
		});
	});
});
