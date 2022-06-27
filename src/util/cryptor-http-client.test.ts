import nock from "nock";
import { CryptorHttpClient } from "utils/cryptor-http-client";
import { getLogger } from "config/logger";

describe("cryptor-http-client", () => {

	const TEST_LOGGER = getLogger("test");
	const BASE_URL = "http://cyrptor-clien-test.nock";
	const CHALLENGE = "random-string";

	const nockScope = () => {
		return nock(BASE_URL, {
			reqheaders: {
				"x-cryptor-client": CHALLENGE
			}
		});
	};

	const newClient = (keyAlias: string) => {
		return new CryptorHttpClient({
			keyAlias,
			baseUrl: BASE_URL,
			cryptorChanllenge: CHALLENGE
		});
	};

	afterEach(()=>{
		nock.cleanAll();
	});

	it("should encrypt and decrypt data without encryption context", async () => {

		//setup mock
		nockScope()
			.post("/cryptor/encrypt/mykey", {
				plainText: "foo",
				encryptionContext: {}
			})
			.reply(200, { cipherText: "bar" })
			.post("/cryptor/decrypt", {
				cipherText: "bar",
				encryptionContext: {}
			})
			.reply(200, { plainText: "foo" });
		const client = newClient("mykey");

		//test encryption
		const encrypted = await client.encrypt(TEST_LOGGER, "foo");
		expect(encrypted).toBe("bar");

		const decrypted = await client.decrypt(TEST_LOGGER, "bar");
		expect(decrypted).toBe("foo");

	});

	it("should encrypt and decrypt data with execution context", async () => {

		//setup mock
		nockScope()
			.post("/cryptor/encrypt/mykey", {
				plainText: "foo",
				encryptionContext: {
					randomThing: "abc"
				}
			})
			.reply(200, { cipherText: "bar" })
			.post("/cryptor/decrypt", {
				cipherText: "bar",
				encryptionContext: {
					randomThing: "abc"
				}
			})
			.reply(200, { plainText: "foo" });
		const client = newClient("mykey");

		//test encryption
		const encrypted = await client.encrypt(TEST_LOGGER, "foo", { randomThing: "abc" });
		expect(encrypted).toBe("bar");

		const decrypted = await client.decrypt(TEST_LOGGER, "bar", { randomThing: "abc" });
		expect(decrypted).toBe("foo");
	});

	it("should throw a error when it cannot decrypt data", async () => {
		//setup mock
		nockScope()
			.post("/cryptor/encrypt/mykey", {
				plainText: "foo",
				encryptionContext: {
					randomThing: "abc"
				}
			})
			.reply(200, { cipherText: "bar" })
			.post("/cryptor/decrypt", {
				cipherText: "bar",
				encryptionContext: {
					randomThing: "abc"
				}
			})
			.reply(403, "cannot decrypt bar");
		const client = newClient("mykey");

		//test error handling
		const encrypted = await client.encrypt(TEST_LOGGER, "foo", { randomThing: "abc" });
		return expect(client.decrypt(TEST_LOGGER, encrypted, { randomThing: "abc" }))
			.rejects.toThrowError("Request failed with status code 403");

	});
});
