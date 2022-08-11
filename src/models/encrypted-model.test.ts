import { DataTypes, Sequelize } from "sequelize";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";
import { EncryptedModel } from "./encrypted-model";

class Dummy extends EncryptedModel {
	id: number;
	name: string;
	a: string;
	b: string;

	getEncryptionSecretKey() {
		return EncryptionSecretKeyEnum.GITHUB_SERVER_APP;
	}

	async getEncryptContext(): Promise<Record<string, string | number>> {
		return { name: this.name };
	}

	getSecretFields() {
		return ["a", "b"] as const;
	}

}

Dummy.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false
	},
	a: {
		type: DataTypes.STRING,
		allowNull: false
	},
	b: {
		type: DataTypes.STRING,
		allowNull: false
	}
}, {
	sequelize: new Sequelize("sqlite::memory:", {
		dialect: "postgres"
	})
});
Dummy.addEncryptionHooks();

const newRandomId = () => {
	return Math.floor(Math.random() * 1000000);
};

describe("Encrypted model", () => {
	let valuesWithIdBefore: any;
	let valuesWithId: any;
	let valuesWithId2: any;
	beforeEach(async () => {
		EncryptionClient.encrypt = jest.fn((_, p) => "encrypted:" + p) as any;
		EncryptionClient.decrypt = jest.fn((c) => c.substring("encrypted:".length)) as any;
		const id = newRandomId();
		valuesWithIdBefore = { id, name: "test-before", a: "aaa1-before", b: "bbb1-before" };
		valuesWithId = { id, name: "test", a: "aaa1", b: "bbb1" };
		const id2 = newRandomId();
		valuesWithId2 = { id: id2, name: "test_2", a: "aaa1_2", b: "bbb1_2" };
		await Dummy.sync();
		await Dummy.truncate({ force: true });
	});
	describe("Instance hooks", () => {
		it("Calling SAVE: should encrypt/decrypt successfully", async () => {
			await Dummy.build({ ...valuesWithId }).save();
			await verifyResultValues();
			await verifyEncryptionClient_Encrypt_Called();
			await verifyEncryptionClient_Decrypt_Called();
		});
		it("Calling UPDATE: should encrypt successfully", async () => {
			const inst = await Dummy.build({ ...valuesWithIdBefore }).save();
			await inst.update({ ...valuesWithId });
			await verifyResultValues();
			await verifyEncryptionClient_Encrypt_Called(0, valuesWithIdBefore);
			await verifyEncryptionClient_Encrypt_Called(2, valuesWithId);
			await verifyEncryptionClient_Decrypt_Called();
		});
		it("Calling UPSERT (new): should encrypt/decrypt successfully", async () => {
			await Dummy.upsert({ ...valuesWithId });
			await verifyResultValues();
			await verifyEncryptionClient_Encrypt_Called();
			await verifyEncryptionClient_Decrypt_Called();
		});
	});
	describe("Model/class hooks", () => {
		it("Calling CREATE: should encrypt/decrypt successfully", async () => {
			await Dummy.create({ ...valuesWithId });
			await verifyResultValues();
			await verifyEncryptionClient_Encrypt_Called();
			await verifyEncryptionClient_Decrypt_Called();
		});
		it("Calling UPDATE: should encrypt successfully", async () => {
			await Dummy.build({ ...valuesWithIdBefore }).save();
			Dummy.update({ ...valuesWithId }, { where: { id: valuesWithIdBefore.id } });
			await verifyResultValues();
			await verifyEncryptionClient_Encrypt_Called(0, valuesWithIdBefore);
			await verifyEncryptionClient_Encrypt_Called(2, valuesWithId);
			await verifyEncryptionClient_Decrypt_Called();
		});
	});
	describe("Bulk operation", () => {
		it("Calling BULK CREATE", async ()=>{
			await Dummy.bulkCreate([{ ...valuesWithId }, { ...valuesWithId2 }]);
			await verifyResultValues(valuesWithId);
			await verifyResultValues(valuesWithId2);
			await verifyEncryptionClient_Encrypt_Called(0, valuesWithId);
			await verifyEncryptionClient_Encrypt_Called(2, valuesWithId2);
			await verifyEncryptionClient_Decrypt_Called(0, valuesWithId);
			await verifyEncryptionClient_Decrypt_Called(2, valuesWithId2);
		});
		it("Calling BULK BUILD", async ()=>{
			const [inst1, inst2] = Dummy.bulkBuild([{ ...valuesWithId }, { ...valuesWithId2 }]);
			await inst1.save();
			await inst2.save();
			await verifyResultValues(valuesWithId);
			await verifyResultValues(valuesWithId2);
			await verifyEncryptionClient_Encrypt_Called(0, valuesWithId);
			await verifyEncryptionClient_Encrypt_Called(2, valuesWithId2);
			await verifyEncryptionClient_Decrypt_Called(0, valuesWithId);
			await verifyEncryptionClient_Decrypt_Called(2, valuesWithId2);
		});
	});
	const verifyResultValues = async (values = valuesWithId) => {
		const result = await Dummy.findByPk(values.id);
		expect(result.a).toBe("encrypted:" + values.a);
		expect(result.b).toBe("encrypted:" + values.b);
		expect(await result.decrypt("a")).toBe(values.a);
		expect(await result.decrypt("b")).toBe(values.b);
	};
	const verifyEncryptionClient_Encrypt_Called = async (offset = 0, values = valuesWithId) => {
		expect(EncryptionClient.encrypt).toHaveBeenNthCalledWith(offset + 1, EncryptionSecretKeyEnum.GITHUB_SERVER_APP, values.a, { "name": values.name });
		expect(EncryptionClient.encrypt).toHaveBeenNthCalledWith(offset + 2, EncryptionSecretKeyEnum.GITHUB_SERVER_APP, values.b, { "name": values.name });
	};
	const verifyEncryptionClient_Decrypt_Called = async (offset = 0, values = valuesWithId) => {
		expect(EncryptionClient.decrypt).toHaveBeenNthCalledWith(offset + 1, "encrypted:" + values.a, { "name": values.name });
		expect(EncryptionClient.decrypt).toHaveBeenNthCalledWith(offset + 2, "encrypted:" + values.b, { "name": values.name });
	};
});
