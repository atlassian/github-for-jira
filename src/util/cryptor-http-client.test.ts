import { CryptorHttpClient } from "utils/cryptor-http-client";
import { getLogger } from "config/logger";

describe('cryptor-http-client', () => {

	const TEST_LOGGER = getLogger("test");

	it('should encrypt and decrypt data without encryption context', async () => {
		const client = new CryptorHttpClient("mykey");
		const encrypted = await client.encrypt(TEST_LOGGER, "foo");
		const decrypted = await client.decrypt(TEST_LOGGER, encrypted);
		expect(encrypted).not.toBe("foo");
		expect(decrypted).toBe("foo");
	});

	it('should encrypt and decrypt data with execution context', async () => {
		const client = new CryptorHttpClient("mykey");
		const encrypted = await client.encrypt(TEST_LOGGER, "foo", { jiraHostname: 'https://foo' });
		const decrypted = await client.decrypt(TEST_LOGGER, encrypted, { jiraHostname: 'https://foo' });
		expect(encrypted).not.toBe("foo");
		expect(decrypted).toBe("foo");
	});

	it('should throw a error when it cannot decrypt data',  async () => {
		const client = new CryptorHttpClient("mykey");
		const encrypted = await client.encrypt(TEST_LOGGER, "foo", { jiraHostname: 'https://foo' });
		return expect(client.decrypt(TEST_LOGGER, encrypted)).rejects.toThrowError('Request failed with status code 403');

	});
});
