import { Installation } from "./installation";
import Sequelize from "sequelize";
import { v4 as UUID } from "uuid";
import { getHashedKey } from "models/sequelize";

describe("Installation", () => {
	describe("Decryption with cryptor", () => {
		it("can decrypted the new encryptedSharedSecret column directly", async () => {
			const clientKey = UUID();
			await inserRawInstallation({
				clientKey,
				secretsColumn: "non-sense",
				encryptedSharedSecretColumn: "encrypted:some-plain-text"
			});
			const installation = await Installation.findOne({ where: { clientKey } });
			expect(installation.encryptedSharedSecret).toBe("encrypted:some-plain-text");
			expect(await installation.decrypt("encryptedSharedSecret")).toBe("some-plain-text");
		});
	});
	describe("Encryption with cryptor", () => {
		it("should auto set and encrypted the new 'encryptedSharedSecret' when install", async () => {
			const clientKey = UUID();
			await Installation.install({
				host: "whatever.abc",
				clientKey,
				sharedSecret: "some-plain-shared-secret-install"
			});
			const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
			expect(encryptedSharedSecretInDB).toEqual("encrypted:some-plain-shared-secret-install");
		});
		it("should auto set and encrypted the new 'encryptedSharedSecret' when update", async () => {
			const clientKey = UUID();
			await Installation.install({
				host: "whatever.abc",
				clientKey,
				sharedSecret: "old-shared-secret"
			});
			const installation = await Installation.findOne({ where: { clientKey: getHashedKey(clientKey) } });
			await installation.update({
				sharedSecret: "new-shared-secret"
			});
			const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
			expect(encryptedSharedSecretInDB).toEqual("encrypted:new-shared-secret");
		});
		it("should auto set and encrypted the new 'encryptedSharedSecret' when create", async () => {
			const clientKey = UUID();
			await Installation.create({
				host: "whatever.abc",
				clientKey: getHashedKey(clientKey),
				sharedSecret: "some-plain-shared-secret-create"
			});
			const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
			expect(encryptedSharedSecretInDB).toEqual("encrypted:some-plain-shared-secret-create");
		});
		it("should auto set and encrypted the new 'encryptedSharedSecret' when build", async () => {
			const clientKey = UUID();
			await Installation.build({
				host: "whatever.abc",
				clientKey: getHashedKey(clientKey),
				sharedSecret: "some-plain-shared-secret-build"
			}).save();
			const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
			expect(encryptedSharedSecretInDB).toEqual("encrypted:some-plain-shared-secret-build");
		});
		it("should use the sharedSecret when both set", async () => {
			const clientKey = UUID();
			await Installation.create({
				host: "whatever.abc",
				clientKey: getHashedKey(clientKey), //TODO: indicate in-consistent usage of the model
				sharedSecret: "secret-A",
				encryptedSharedSecret: "secret-B"
			});
			const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
			expect(encryptedSharedSecretInDB).toEqual("encrypted:secret-A");
		});
	});

	const inserRawInstallation = async ({ clientKey, secretsColumn, encryptedSharedSecretColumn }) => {
		return await Installation.sequelize?.query(`
					insert into "Installations"
					("secrets", "encryptedSharedSecret", "clientKey", "createdAt", "updatedAt")
					values
					('${secretsColumn}', '${encryptedSharedSecretColumn}', '${clientKey}', now(), now())
				`, {
			type: Sequelize.QueryTypes.INSERT
		});
	};

	const findEncryptedSharedSecretBy = async ({ clientKey }) => {
		const hashedClientKey = getHashedKey(clientKey);
		const found = await Installation.sequelize?.query(`
			select "encryptedSharedSecret" from "Installations" where "clientKey" = '${hashedClientKey}'
		`, { plain: true });
		if (!found) throw new Error("Cannot find installation by clientKey " + clientKey);
		return found.encryptedSharedSecret;
	};

});
