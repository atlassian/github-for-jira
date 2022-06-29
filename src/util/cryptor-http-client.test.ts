import { CryptorHttpClient } from "utils/cryptor-http-client";
import { getLogger } from "config/logger";

describe("cryptor-http-client", () => {

	const TEST_LOGGER = getLogger("test");

	it("should hit the docker mock implentation and success", async () => {
		const encrypted = await CryptorHttpClient.encrypt(CryptorHttpClient.GITHUB_SERVER_APP_SECRET, "1234", TEST_LOGGER);
		expect(encrypted).toBe("4321");
		const decrypted = await CryptorHttpClient.decrypt("4321", TEST_LOGGER);
		expect(decrypted).toBe("1234");
	});

});
