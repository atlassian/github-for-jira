import { AppTokenKey } from "./app-token-key";

describe("AppTokenKey", () => {

	it("serializes correctly", async () => {
		const expectedString = "https://api.github.com###4711###";
		const installationId = new AppTokenKey("https://api.github.com", 4711);
		expect(installationId.toString()).toBe(expectedString);
	});

	it("deserializes correctly", async () => {
		const deserializedAppTokenKey = AppTokenKey.fromString("https://api.github.com###4711###");
		expect(deserializedAppTokenKey.githubBaseUrl).toBe("https://api.github.com");
		expect(deserializedAppTokenKey.appId).toBe(4711);
	});

});
