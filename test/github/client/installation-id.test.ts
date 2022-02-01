import { InstallationId } from "../../../src/github/client/installation-id";

describe("InstallationId", () => {

	it("serializes correctly", async () => {
		const expectedString = "https://api.github.com###4711###12345678";
		const installationId = new InstallationId("https://api.github.com", 4711, 12345678);
		expect(installationId.toString()).toBe(expectedString);
	});

	it("deserializes correctly", async () => {
		const deserializedInstallationId = InstallationId.fromString("https://api.github.com###4711###12345678")
		expect(deserializedInstallationId.githubBaseUrl).toBe("https://api.github.com");
		expect(deserializedInstallationId.appId).toBe(4711);
		expect(deserializedInstallationId.installationId).toBe(12345678);
	});

});
