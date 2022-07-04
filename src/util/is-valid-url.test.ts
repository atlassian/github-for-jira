import { isValidUrl } from "utils/is-valid-url";

describe("Is valid url", () => {
	it("should return true if valid url is provided", async () => {
		expect(isValidUrl("http://myvalidurl.com")).toBeTruthy();
		expect(isValidUrl("https://myvalidurl.net")).toBeTruthy();
	});

	it("should return false if invalid url is provided", async () => {
		expect(isValidUrl("noprotocolortopleveldomain")).toBeFalsy();
		expect(isValidUrl("https://www.ihavenottopleveldomain")).toBeFalsy();
		expect(isValidUrl("www.wheresmyprotocol.com")).toBeFalsy();
	});
});
