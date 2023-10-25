import { Installation } from "./installation";
import { QueryTypes } from "sequelize";
import { v4 as UUID } from "uuid";
import { getHashedKey } from "models/sequelize";
import { getLogger } from "config/logger";

describe("Installation", () => {
	describe("Retrieving plainClientKey", () => {
		it("should save origin unhashed plainClientKey", async () => {
			const inst = await Installation.install({ clientKey: "1234", host: jiraHost, sharedSecret: "sss" });
			const found = await Installation.findByPk(inst.id);
			expect(found?.plainClientKey).toBe("1234");
		});
		it("should update origin unhashed plainClientKey for existing record", async () => {
			//prepare
			const origin = await Installation.install({ clientKey: "1234", host: jiraHost, sharedSecret: "sss" });
			await Installation.sequelize?.query(`update "Installations" set "plainClientKey" = null where "id" = ${origin.id}`);
			const nullPlainClientKeyInst = await Installation.findByPk(origin.id);
			//make sure plainClientKey is null
			expect(nullPlainClientKeyInst?.id).toBe(origin.id);
			expect(nullPlainClientKeyInst?.plainClientKey).toBeNull();

			//update it
			const updatedInst = await Installation.install({ clientKey: "1234", host: jiraHost, sharedSecret: "sss" });
			const finalResultInst = await Installation.findByPk(updatedInst.id);

			expect(updatedInst.id).toBe(origin.id);
			expect(finalResultInst?.id).toBe(origin.id);
			expect(finalResultInst?.plainClientKey).toBe("1234");
		});
	});
	describe("Decryption with cryptor", () => {
		it("can decrypted the new safeSharedSecret column successfully", async () => {
			const clientKey = UUID();
			await insertNewInstallation({ clientKey });
			const installation = await Installation.findOne({ where: { clientKey } });
			expect(installation?.encryptedSharedSecret).toBe("encrypted:some-plain-text");
			expect(await installation?.decrypt("encryptedSharedSecret", getLogger("test"))).toBe("some-plain-text");
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
			await installation?.update({
				encryptedSharedSecret: "new-shared-secret"
			});
			const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
			expect(encryptedSharedSecretInDB).toEqual("encrypted:new-shared-secret");
		});
		it("should auto set and encrypted the new 'encryptedSharedSecret' when create", async () => {
			const clientKey = UUID();
			await Installation.create({
				host: "whatever.abc",
				clientKey: getHashedKey(clientKey),
				encryptedSharedSecret: "some-plain-shared-secret-create"
			});
			const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
			expect(encryptedSharedSecretInDB).toEqual("encrypted:some-plain-shared-secret-create");
		});
		it("should auto set and encrypted the new 'encryptedSharedSecret' when build", async () => {
			const clientKey = UUID();
			await Installation.build({
				host: "whatever.abc",
				clientKey: getHashedKey(clientKey),
				encryptedSharedSecret: "some-plain-shared-secret-build"
			}).save();
			const encryptedSharedSecretInDB = await findEncryptedSharedSecretBy({ clientKey });
			expect(encryptedSharedSecretInDB).toEqual("encrypted:some-plain-shared-secret-build");
		});
	});
	const insertNewInstallation = async ({ clientKey }) => {
		return await Installation.sequelize?.query(`
					insert into "Installations"
					("secrets", "encryptedSharedSecret", "clientKey", "createdAt", "updatedAt")
					values
					('xxxxx', 'encrypted:some-plain-text', '${clientKey as string}', now(), now())
				`, {
			type: QueryTypes.INSERT
		});
	};

	const findEncryptedSharedSecretBy = async ({ clientKey }) => {
		const hashedClientKey = getHashedKey(clientKey);
		const found = await Installation.sequelize?.query(`
			select "encryptedSharedSecret" from "Installations" where "clientKey" = '${hashedClientKey}'
		`, { plain: true });
		if (!found) throw new Error(`Cannot find installation by clientKey ${clientKey as string}`);
		return found.encryptedSharedSecret;
	};
});
