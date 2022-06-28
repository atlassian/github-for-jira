import { CryptorHttpClient } from "utils/cryptor-http-client";
import { getLogger } from "config/logger";

describe("cryptor-http-client", () => {

	const TEST_LOGGER = getLogger("test");

	beforeEach(()=>{
		cryptorEncryptDecryptNock();
	});

	it("should encrypt and decrypt data successfully", async () => {
		//test encryption
		const encrypted = await CryptorHttpClient.encrypt(CryptorHttpClient.GITHUB_SERVER_APP_SECRET, "foo", TEST_LOGGER);
		expect(encrypted).toBe("bar");

		const decrypted = await CryptorHttpClient.decrypt("bar", TEST_LOGGER);
		expect(decrypted).toBe("foo");

	});

});
