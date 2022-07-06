import { Installation } from "./installation";
import Sequelize from "sequelize";
import { v4 as UUID } from "uuid";
import { getHashedKey } from "models/sequelize";

describe("Installation", () => {
	describe("Encryption and decryption with cryptor", () => {
		describe("operate via existing 'sharedSecret' property", () => {
			it("should auto set and encrypted the new 'encryptedSharedSecret' when install", async () => {
				const clientKey = UUID();
				await Installation.install({
					host: "whatever.abc",
					clientKey,
					sharedSecret: "some-plain-shared-secret"
				});
				const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
				expect(encryptedSharedSecretInDB).toEqual("encrypted:some-plain-shared-secret");
			});
			it("can decrypted the new safeSharedSecret column successfully", async () => {
				const clientKey = UUID();
				await insertNewInstallation({ clientKey });
				const installation = await Installation.findOne({ where: { clientKey } });
				expect(installation.encryptedSharedSecret).toBe("encrypted:some-plain-text");
				expect(await installation.decrypt("encryptedSharedSecret")).toBe("some-plain-text");
			});
		});
		describe("operate via new 'encryptedSharedSecret' property", () => {
			it("should auto set and encrypted the new 'encryptedSharedSecret' when manually build", async () => {
				const clientKey = UUID();
				await Installation.build({
					host: "whatever.abc",
					clientKey: getHashedKey(clientKey), //TODO: indicate in-consistent usage of the model
					sharedSecret: "secret-A",
					encryptedSharedSecret: "secret-B"
				}).save();
				const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
				expect(encryptedSharedSecretInDB).toEqual("encrypted:secret-B");
			});
			it("can decrypted the new safeSharedSecret column successfully when manually build", async () => {
				const clientKey = UUID();
				await Installation.build({
					host: "whatever.abc",
					clientKey: getHashedKey(clientKey),
					sharedSecret: "secret-A",
					encryptedSharedSecret: "secret-B"
				}).save();
				const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
				expect(encryptedSharedSecretInDB).toEqual("encrypted:secret-B");
			});
		});
	});
	const insertNewInstallation = async ({ clientKey }) => {
		return await Installation.sequelize?.query(`
					insert into "Installations"
					("secrets", "encryptedSharedSecret", "clientKey", "createdAt", "updatedAt")
					values
					('xxxxx', 'encrypted:some-plain-text', '${clientKey}', now(), now())
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
