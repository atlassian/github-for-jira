import { EncryptionClient } from "utils/encryption-client";
import { getLogger } from "config/logger";

describe("encryption-client", () => {

	const TEST_LOGGER = getLogger("test");

	it("should hit the docker mock implentation and success", async () => {
		const encrypted = await EncryptionClient.encrypt(EncryptionClient.GITHUB_SERVER_APP_SECRET, "some-text", {}, TEST_LOGGER);
		expect(encrypted).toBe("encrypted:some-text");
		const decrypted = await EncryptionClient.decrypt("encrypted:some-text", {}, TEST_LOGGER);
		expect(decrypted).toBe("some-text");
	});

});
