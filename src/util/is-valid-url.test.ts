import { isValidUrl } from "utils/is-valid-url";

describe("Is valid url", () => {
	it("should return true if valid url is provided", async () => {
		expect(isValidUrl("http://myvalidurl.com")).toBeTruthy();
		expect(isValidUrl("https://myvalidurl.net")).toBeTruthy();
		expect(isValidUrl("https://192.213.23.12/branch/mypage")).toBeTruthy();
	});

	it("should return false if invalid url is provided", async () => {
		expect(isValidUrl("accd://thatsnotavalidprotocol")).toBeFalsy();
		expect(isValidUrl("thisaintaurlatall")).toBeFalsy();
		expect(isValidUrl("www.wheresmyprotocol.com")).toBeFalsy();
	});

	it("should return false if url has port orquery parameters", async () => {
		expect(isValidUrl("https://192.213.23.12/branch/mypage/?foo=bar")).toBeFalsy();
		expect(isValidUrl("https://localhost:12/branch/mypage/")).toBeFalsy();
		expect(isValidUrl("https://localhost/branch/mypage/")).toBeFalsy();
	});
});
