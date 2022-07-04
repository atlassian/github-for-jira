import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";

describe("encryption-client", () => {

	it("should hit the docker mock implentation and success", async () => {
		const encrypted = await EncryptionClient.encrypt(EncryptionSecretKeyEnum.GITHUB_SERVER_APP, "some-text");
		expect(encrypted).toBe("encrypted:some-text");
		const decrypted = await EncryptionClient.decrypt("encrypted:some-text");
		expect(decrypted).toBe("some-text");
	});

});
