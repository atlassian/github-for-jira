import { DataTypes, Sequelize } from "sequelize";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";
import { EncryptedModel } from "./encrypted-model";
import { getLogger } from "config/logger";

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
		return  ["a", "b"] as const;
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
	hooks: {
		beforeSave: async (app, opts) => {
			const optsFields = opts.fields?.filter((it): it is string => !!it);
			await app.encryptChangedSecretFields(optsFields, getLogger("test"));
		},

		beforeBulkCreate: async (apps, opts) => {
			for (const app of apps) {
				const optsFields = opts.fields?.filter((it): it is string => !!it);
				await app.encryptChangedSecretFields(optsFields, getLogger("test"));
			}
		}
	},
	sequelize: new Sequelize("sqlite::memory:", {
		dialect: "postgres"
	})
});

const newId = () => {
	return Math.floor(Math.random() * 1000000);
};

describe("Encrypted model", () => {
	beforeEach(() => {
		EncryptionClient.encrypt = jest.fn((_, p) => `encrypted:${p as string}`) as any;
		EncryptionClient.decrypt = jest.fn((c) => c.substring("encrypted".length)) as any;
	});

	it("should encrypt successfully", async () => {
		await Dummy.sync();
		const id = newId();
		const dummy = Dummy.build({ id, name: "test", a: "aaa1", b: "bbb1" });
		await dummy.save();
		expect(EncryptionClient.encrypt).toHaveBeenNthCalledWith(1, EncryptionSecretKeyEnum.GITHUB_SERVER_APP, "aaa1", { "name": "test" });
		expect(EncryptionClient.encrypt).toHaveBeenNthCalledWith(2, EncryptionSecretKeyEnum.GITHUB_SERVER_APP, "bbb1", { "name": "test" });
	});

	it("should decrypt successfully", async () => {
		await Dummy.sync();
		const id = newId();
		await Dummy.create({ id, name: "test", a: "aaa1", b: "bbb1" });
		const dummy = await Dummy.findOne({ where: { name: "test" } });
		await dummy?.decrypt("a", getLogger("test"));
		await dummy?.decrypt("b", getLogger("test"));
		expect(EncryptionClient.decrypt).toHaveBeenNthCalledWith(1, "encrypted:aaa1", { "name": "test" });
		expect(EncryptionClient.decrypt).toHaveBeenNthCalledWith(2, "encrypted:bbb1", { "name": "test" });
	});
});
