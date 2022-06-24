import { CryptorHttpClient } from "utils/cryptor-http-client";
import { getLogger } from "config/logger";


describe('cryptor-http-client', () => {

	it('should encrypt and decrypt data without encryption context', async () => {
		const client = new CryptorHttpClient("mykey");
		const encrypted = await client.encrypt(getLogger("test"), "foo");
		const decrypted = await client.decrypt(getLogger("test"), encrypted);
		expect(encrypted).not.toBe("foo");
		expect(decrypted).toBe("foo");
	});

	// it('should encrypt and decrypt data with execution context', () => {
	//
	// });
	//
	// it('should throw a error when it cannot decrypt data',  () => {
	//
	// });
});
